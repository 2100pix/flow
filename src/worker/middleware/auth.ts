import { and, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { createDb } from "../db";
import { sessions, users, workspaceMembers, workspaces } from "../db/schema";
import { hashSessionToken, SESSION_COOKIE } from "../lib/session";
import { INVS_WORKSPACE_ID } from "../lib/workspace";
import type { AuthContext, WorkspaceRole } from "../types/auth";
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
    },
  });

  await next();
});

export function requireRole(...allowedRoles: WorkspaceRole[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const auth = c.var.auth;

    if (!allowedRoles.includes(auth.workspace.role)) {
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
