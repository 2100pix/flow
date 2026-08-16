import { and, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { parsePermissionKeys, type PermissionKey } from "../../shared/permissions";
import { builtInRoleDefinitions } from "../../shared/roles";
import { createDb } from "../db";

import { sessions, users, workspaceMembers, workspaceRolePermissions, workspaceRoles, workspaces } from "../db/schema";
import { hashSessionToken, SESSION_COOKIE } from "../lib/session";
import { INVS_WORKSPACE_ID } from "../lib/workspace";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type AuthEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

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

  const [result] = await db
    .select({
      userId: users.id,

      displayName: users.displayName,

      avatarUrl: users.avatarUrl,

      role: workspaceMembers.role,

      customRoleId: workspaceMembers.customRoleId,

      workspaceName: workspaces.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, INVS_WORKSPACE_ID)))
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!result) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    const secure = new URL(c.req.url).protocol === "https:";

    deleteCookie(c, SESSION_COOKIE, {
      path: "/",
      secure,
    });

    return c.json(
      {
        error: {
          code: "SESSION_EXPIRED",
          message: "Session expired",
        },
      },
      401,
    );
  }

  const builtInRole = builtInRoleDefinitions.find((role) => role.key === result.role);

  if (!builtInRole) {
    return c.json(
      {
        error: {
          code: "INVALID_ROLE",
          message: "Workspace role is invalid",
        },
      },
      403,
    );
  }

  let permissions: PermissionKey[] = [...builtInRole.permissions];

  let customRole: {
    id: string;
    name: string;
  } | null = null;

  if (result.role === "member" && result.customRoleId) {
    const roleRows = await db
      .select({
        id: workspaceRoles.id,

        name: workspaceRoles.name,

        permissionKey: workspaceRolePermissions.permissionKey,
      })
      .from(workspaceRoles)
      .leftJoin(workspaceRolePermissions, eq(workspaceRolePermissions.roleId, workspaceRoles.id))
      .where(and(eq(workspaceRoles.id, result.customRoleId), eq(workspaceRoles.workspaceId, INVS_WORKSPACE_ID)));

    if (roleRows.length === 0) {
      return c.json(
        {
          error: {
            code: "INVALID_CUSTOM_ROLE",
            message: "Custom role is invalid",
          },
        },
        403,
      );
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

    permissions = parsedPermissions;
  }

  c.set("auth", {
    user: {
      id: result.userId,

      displayName: result.displayName,

      avatarUrl: result.avatarUrl,
    },

    workspace: {
      id: INVS_WORKSPACE_ID,

      name: result.workspaceName,

      role: result.role,

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
