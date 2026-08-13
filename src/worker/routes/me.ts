import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";

import { createDb } from "../db";
import { sessions, users, workspaceMembers } from "../db/schema";
import { hashSessionToken, SESSION_COOKIE } from "../lib/session";
import { INVS_WORKSPACE_ID } from "../lib/workspace";
import type { AppBindings } from "../types/app-env";

export const meRoutes = new Hono<{
  Bindings: AppBindings;
}>();

meRoutes.get("/", async (c) => {
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
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, INVS_WORKSPACE_ID)))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!result) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    deleteCookie(c, SESSION_COOKIE, {
      path: "/",
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

  return c.json({
    data: {
      user: {
        id: result.userId,
        displayName: result.displayName,
        avatarUrl: result.avatarUrl,
      },
      workspace: {
        id: INVS_WORKSPACE_ID,
        role: result.role,
      },
    },
  });
});
