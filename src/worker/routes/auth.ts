import { and, eq, lte } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { createDb } from "../db";
import { sessions, users, workspaceMembers } from "../db/schema";
import { createId } from "../lib/id";
import { createSessionToken, getSessionExpiresAt, hashSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../lib/session";
import { INVS_WORKSPACE_ID } from "../lib/workspace";
import type { AppBindings } from "../types/app-env";

const OAUTH_STATE_COOKIE = "flow_oauth_state";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

function getDiscordAvatarUrl(user: DiscordUser) {
  if (!user.avatar) {
    return null;
  }

  const animated = user.avatar.startsWith("a_") ? "&animated=true" : "";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128${animated}`;
}

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

  const discordUser = (await userResponse.json()) as DiscordUser;

  const db = createDb(c.env.flow_db);
  const now = new Date();

  const displayName = discordUser.global_name ?? discordUser.username;

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
    .where(and(eq(workspaceMembers.workspaceId, INVS_WORKSPACE_ID), eq(workspaceMembers.userId, flowUser.id)))
    .limit(1);
  const [existingWorkspaceMember] = await db
    .select({
      userId: workspaceMembers.userId,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, INVS_WORKSPACE_ID))
    .limit(1);
  if (!membership && !existingWorkspaceMember && discordUser.id === c.env.FLOW_BOOTSTRAP_OWNER_DISCORD_USER_ID) {
    await db
      .insert(workspaceMembers)
      .values({
        workspaceId: INVS_WORKSPACE_ID,
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
    return c.json(
      {
        error: {
          code: "WORKSPACE_ACCESS_DENIED",
          message: "You do not have access to this workspace",
        },
      },
      403,
    );
  }

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

  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
  });

  return c.json({
    data: {
      success: true,
    },
  });
});
