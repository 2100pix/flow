import { and, asc, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { parsePermissionKeys, type PermissionKey } from "../../shared/permissions";
import { builtInRoleDefinitions } from "../../shared/roles";
import { createDb } from "../db";

import { memberExpertise, sessions, users, workspaceExpertise, workspaceMembers, workspaceRolePermissions, workspaceRoles, workspaces } from "../db/schema";
import { hashSessionToken, SESSION_COOKIE } from "../lib/session";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type AuthEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

async function invalidateSession(c: Parameters<ReturnType<typeof createMiddleware<AuthEnv>>>[0], db: ReturnType<typeof createDb>, sessionId: string, code: "SESSION_EXPIRED" | "SESSION_INVALID", message: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  const secure = new URL(c.req.url).protocol === "https:";

  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure,
  });

  return c.json(
    {
      error: {
        code,
        message,
      },
    },
    401,
  );
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE);

  if (!sessionToken) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
      },
      401,
    );
  }

  const sessionId = await hashSessionToken(sessionToken);

  const db = createDb(c.env.flow_db);
  const workspaceId = c.env.FLOW_WORKSPACE_ID;

  const [result] = await db
    .select({
      userId: users.id,
      discordUserId: users.discordUserId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      firstName: users.firstName,
      lastName: users.lastName,
      timeZone: users.timeZone,
      role: workspaceMembers.role,
      customRoleId: workspaceMembers.customRoleId,
      workspaceName: workspaces.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!result) {
    return invalidateSession(c, db, sessionId, "SESSION_EXPIRED", "Session expired");
  }

  const builtInRole = builtInRoleDefinitions.find((role) => role.key === result.role);

  if (!builtInRole) {
    return invalidateSession(c, db, sessionId, "SESSION_INVALID", "Session is no longer valid");
  }

  let permissions: PermissionKey[] = [...builtInRole.permissions];

  let customRole: {
    id: string;
    name: string;
  } | null = null;

  if (result.customRoleId) {
    const roleRows = await db
      .select({
        id: workspaceRoles.id,

        name: workspaceRoles.name,

        permissionKey: workspaceRolePermissions.permissionKey,
      })
      .from(workspaceRoles)
      .leftJoin(workspaceRolePermissions, eq(workspaceRolePermissions.roleId, workspaceRoles.id))
      .where(and(eq(workspaceRoles.id, result.customRoleId), eq(workspaceRoles.workspaceId, workspaceId)));

    if (roleRows.length === 0) {
      return invalidateSession(c, db, sessionId, "SESSION_INVALID", "Session is no longer valid");
    }

    customRole = {
      id: roleRows[0].id,
      name: roleRows[0].name,
    };

    const rawPermissionKeys = roleRows.length === 1 && roleRows[0].permissionKey === null ? [] : roleRows.map((row) => row.permissionKey);
    const parsedPermissions = parsePermissionKeys(rawPermissionKeys);

    if (!parsedPermissions) {
      return c.json(
        {
          error: {
            code: "ROLE_PERMISSION_INTEGRITY_ERROR",
            message: "Stored role permissions are invalid",
          },
        },
        500,
      );
    }

    if (result.role === "member") {
      permissions = parsedPermissions;
    }
  }

  const expertiseRows = await db
    .select({
      id: workspaceExpertise.id,

      name: workspaceExpertise.name,
    })
    .from(memberExpertise)
    .innerJoin(workspaceExpertise, eq(memberExpertise.expertiseId, workspaceExpertise.id))
    .where(and(eq(memberExpertise.userId, result.userId), eq(workspaceExpertise.workspaceId, workspaceId)))
    .orderBy(asc(workspaceExpertise.name));

  c.set("auth", {
    user: {
      id: result.userId,

      displayName: result.displayName,

      avatarUrl: result.avatarUrl,

      firstName: result.firstName,

      lastName: result.lastName,

      timeZone: result.timeZone,

      expertise: expertiseRows,
    },

    workspace: {
      id: workspaceId,
      name: result.workspaceName,
      role: result.role,
      isCreator: result.discordUserId === c.env.FLOW_BOOTSTRAP_OWNER_DISCORD_USER_ID,
      customRole,
      permissions,
    },
  });

  await next();
});

export function hasPermission(auth: AuthContext, permission: PermissionKey) {
  return auth.workspace.permissions.includes(permission);
}

export function requirePermission(permission: PermissionKey) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (!hasPermission(c.var.auth, permission)) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",

            message: "You do not have permission to perform this action",
          },
        },
        403,
      );
    }

    await next();
  });
}
