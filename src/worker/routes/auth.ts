import { and, eq, lte } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { createDb } from "../db";
import { sessions, users, workspaceAccessRequestSessions, workspaceAccessRequests, workspaceMembers } from "../db/schema";
import type { PendingAccessContinueResponse } from "../../shared/contracts/auth";
import { getDiscordAvatarUrl, resolveDiscordDisplayName, type DiscordProfileUser } from "../lib/discord-profile";
import { createId } from "../lib/id";
import { createSessionToken, getSessionExpiresAt, hashSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../lib/session";
import { createPendingSessionToken, getPendingSessionExpiresAt, hashPendingSessionToken, PENDING_SESSION_COOKIE, PENDING_SESSION_TTL_SECONDS } from "../lib/pending-session";
import type { AppBindings } from "../types/app-env";

const OAUTH_STATE_COOKIE = "flow_oauth_state";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export const authRoutes = new Hono<{
  Bindings: AppBindings;
}>();

authRoutes.get("/discord", (c) => {
  const state = crypto.randomUUID();
  const secure = new URL(c.req.url).protocol === "https:";

  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: 60 * 10,
    path: "/api/auth/discord",
  });

  const authorizationUrl = new URL("https://discord.com/oauth2/authorize");

  authorizationUrl.searchParams.set("client_id", c.env.DISCORD_CLIENT_ID);

  authorizationUrl.searchParams.set("response_type", "code");

  authorizationUrl.searchParams.set("redirect_uri", c.env.DISCORD_REDIRECT_URI);

  authorizationUrl.searchParams.set("scope", "identify");

  authorizationUrl.searchParams.set("state", state);

  return c.redirect(authorizationUrl.toString());
});

authRoutes.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  const storedState = getCookie(c, OAUTH_STATE_COOKIE);

  const secure = new URL(c.req.url).protocol === "https:";

  deleteCookie(c, OAUTH_STATE_COOKIE, {
    path: "/api/auth/discord",
    secure,
  });

  if (error) {
    return c.json(
      {
        error: {
          code: "DISCORD_AUTH_DENIED",
          message: "Discord authorization was denied",
        },
      },
      400,
    );
  }

  if (!code || !state || !storedState || state !== storedState) {
    return c.json(
      {
        error: {
          code: "INVALID_OAUTH_STATE",
          message: "Invalid OAuth state",
        },
      },
      400,
    );
  }

  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,
      client_secret: c.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: c.env.DISCORD_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    return c.json(
      {
        error: {
          code: "DISCORD_TOKEN_EXCHANGE_FAILED",
          message: "Failed to exchange Discord authorization code",
        },
      },
      502,
    );
  }

  const token = (await tokenResponse.json()) as DiscordTokenResponse;

  const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userResponse.ok) {
    return c.json(
      {
        error: {
          code: "DISCORD_USER_FETCH_FAILED",
          message: "Failed to fetch Discord user",
        },
      },
      502,
    );
  }

  const discordUser = (await userResponse.json()) as DiscordProfileUser;
  const db = createDb(c.env.flow_db);
  const workspaceId = c.env.FLOW_WORKSPACE_ID;
  const now = new Date();
  const displayName = resolveDiscordDisplayName(discordUser);
  const avatarUrl = getDiscordAvatarUrl(discordUser);

  await db
    .insert(users)
    .values({
      id: createId("usr"),
      discordUserId: discordUser.id,
      displayName,
      avatarUrl,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: users.discordUserId,

      set: {
        displayName,
        avatarUrl,
        updatedAt: now,
        lastLoginAt: now,
      },
    });

  const [flowUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.discordUserId, discordUser.id))
    .limit(1);

  if (!flowUser) {
    return c.json(
      {
        error: {
          code: "USER_PERSISTENCE_FAILED",
          message: "Failed to persist user",
        },
      },
      500,
    );
  }

  let [membership] = await db
    .select({
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, flowUser.id)))
    .limit(1);
  const [existingWorkspaceMember] = await db
    .select({
      userId: workspaceMembers.userId,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .limit(1);
  if (!membership && !existingWorkspaceMember && discordUser.id === c.env.FLOW_BOOTSTRAP_OWNER_DISCORD_USER_ID) {
    await db
      .insert(workspaceMembers)
      .values({
        workspaceId: workspaceId,
        userId: flowUser.id,
        role: "owner",
        createdAt: now,
      })
      .onConflictDoNothing();

    membership = {
      role: "owner",
    };
  }

  if (!membership) {
    const pendingSessionToken = createPendingSessionToken();
    const pendingSessionId = await hashPendingSessionToken(pendingSessionToken);
    const pendingSessionExpiresAt = getPendingSessionExpiresAt();

    await db.batch([
      db
        .insert(workspaceAccessRequests)
        .values({
          workspaceId,
          userId: flowUser.id,
          requestedAt: now,
        })
        .onConflictDoNothing(),

      db.delete(workspaceAccessRequestSessions).where(and(eq(workspaceAccessRequestSessions.workspaceId, workspaceId), eq(workspaceAccessRequestSessions.userId, flowUser.id))),

      db.insert(workspaceAccessRequestSessions).values({
        id: pendingSessionId,
        workspaceId,
        userId: flowUser.id,
        expiresAt: pendingSessionExpiresAt,
        createdAt: now,
      }),
    ]);

    setCookie(c, PENDING_SESSION_COOKIE, pendingSessionToken, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      maxAge: PENDING_SESSION_TTL_SECONDS,
      path: "/api/auth/pending",
    });

    return c.redirect("/access-pending");
  }

  await db.delete(workspaceAccessRequestSessions).where(and(eq(workspaceAccessRequestSessions.workspaceId, workspaceId), eq(workspaceAccessRequestSessions.userId, flowUser.id)));

  deleteCookie(c, PENDING_SESSION_COOKIE, {
    path: "/api/auth/pending",
    secure,
  });

  await db.delete(sessions).where(and(eq(sessions.userId, flowUser.id), lte(sessions.expiresAt, now)));
  const sessionToken = createSessionToken();
  const sessionId = await hashSessionToken(sessionToken);
  const expiresAt = getSessionExpiresAt();

  await db.insert(sessions).values({
    id: sessionId,
    userId: flowUser.id,
    expiresAt,
    createdAt: now,
  });

  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return c.redirect("/");
});

authRoutes.post("/logout", async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE);

  if (sessionToken) {
    const sessionId = await hashSessionToken(sessionToken);

    const db = createDb(c.env.flow_db);

    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  const secure = new URL(c.req.url).protocol === "https:";

  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure,
  });

  return c.json({
    data: {
      success: true,
    },
  });
});

authRoutes.post("/pending/continue", async (c) => {
  const pendingSessionToken = getCookie(c, PENDING_SESSION_COOKIE);
  const secure = new URL(c.req.url).protocol === "https:";

  if (!pendingSessionToken) {
    return c.json(
      {
        error: {
          code: "PENDING_SESSION_REQUIRED",
          message: "Pending session is required",
        },
      },
      401,
    );
  }

  const pendingSessionId = await hashPendingSessionToken(pendingSessionToken);

  const db = createDb(c.env.flow_db);
  const workspaceId = c.env.FLOW_WORKSPACE_ID;
  const now = new Date();

  const [pendingSession] = await db
    .select({
      userId: workspaceAccessRequestSessions.userId,
      expiresAt: workspaceAccessRequestSessions.expiresAt,
    })
    .from(workspaceAccessRequestSessions)
    .where(and(eq(workspaceAccessRequestSessions.id, pendingSessionId), eq(workspaceAccessRequestSessions.workspaceId, workspaceId)))
    .limit(1);

  if (!pendingSession) {
    deleteCookie(c, PENDING_SESSION_COOKIE, {
      path: "/api/auth/pending",
      secure,
    });

    return c.json(
      {
        error: {
          code: "PENDING_SESSION_INVALID",
          message: "Pending session is invalid",
        },
      },
      401,
    );
  }

  if (pendingSession.expiresAt.getTime() <= now.getTime()) {
    await db.delete(workspaceAccessRequestSessions).where(eq(workspaceAccessRequestSessions.id, pendingSessionId));

    deleteCookie(c, PENDING_SESSION_COOKIE, {
      path: "/api/auth/pending",
      secure,
    });

    return c.json(
      {
        error: {
          code: "PENDING_SESSION_EXPIRED",
          message: "Pending session has expired",
        },
      },
      401,
    );
  }

  const [membership] = await db
    .select({
      userId: workspaceMembers.userId,
    })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, pendingSession.userId)))
    .limit(1);

  if (!membership) {
    const [accessRequest] = await db
      .select({
        userId: workspaceAccessRequests.userId,
      })
      .from(workspaceAccessRequests)
      .where(and(eq(workspaceAccessRequests.workspaceId, workspaceId), eq(workspaceAccessRequests.userId, pendingSession.userId)))
      .limit(1);

    if (accessRequest) {
      return c.json(
        {
          error: {
            code: "ACCESS_REQUEST_PENDING",
            message: "Access request is still pending",
          },
        },
        409,
      );
    }

    return c.json(
      {
        error: {
          code: "ACCESS_REQUEST_REJECTED",
          message: "Access request was rejected",
        },
      },
      403,
    );
  }

  await db.delete(sessions).where(and(eq(sessions.userId, pendingSession.userId), lte(sessions.expiresAt, now)));

  const sessionToken = createSessionToken();
  const sessionId = await hashSessionToken(sessionToken);
  const expiresAt = getSessionExpiresAt();

  await db.batch([
    db.delete(workspaceAccessRequestSessions).where(eq(workspaceAccessRequestSessions.id, pendingSessionId)),

    db.insert(sessions).values({
      id: sessionId,
      userId: pendingSession.userId,
      expiresAt,
      createdAt: now,
    }),
  ]);

  deleteCookie(c, PENDING_SESSION_COOKIE, {
    path: "/api/auth/pending",
    secure,
  });

  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  const response: PendingAccessContinueResponse = {
    data: {
      success: true,
    },
  };

  return c.json(response);
});
