import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

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

  return c.json({
    data: {
      discordUser: {
        id: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name ?? discordUser.username,
        avatar: discordUser.avatar,
      },
    },
  });
});
