const DISCORD_API_BASE = "https://discord.com/api/v10";

export const DISCORD_GUILD_CATEGORY_TYPE = 4;

export const DISCORD_GUILD_FORUM_TYPE = 15;

type DiscordErrorResponse = {
  code?: number;
  message?: string;
};

export type DiscordGuildChannel = {
  id: string;
  name: string;
  type: number;
  topic?: string | null;
  parent_id?: string | null;
};

export class DiscordApiError extends Error {
  readonly status: number;
  readonly discordCode: number | null;

  constructor(status: number, discordCode: number | null, message: string) {
    super(message);

    this.name = "DiscordApiError";

    this.status = status;

    this.discordCode = discordCode;
  }
}

async function discordFetch<T>(botToken: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bot ${botToken}`);

  headers.set("Accept", "application/json");

  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();

  let body: T | DiscordErrorResponse | null = null;

  if (text) {
    try {
      body = JSON.parse(text) as T | DiscordErrorResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = body as DiscordErrorResponse | null;

    throw new DiscordApiError(response.status, error?.code ?? null, error?.message ? `Discord API ${response.status}: ${error.message}` : `Discord API request failed with status ${response.status}`);
  }

  return body as T;
}

export function listDiscordGuildChannels(botToken: string, guildId: string) {
  return discordFetch<DiscordGuildChannel[]>(botToken, `/guilds/${encodeURIComponent(guildId)}/channels`);
}

type CreateDiscordForumChannelInput = {
  guildId: string;
  name: string;
  topic: string;
  parentId: string | null;
  auditReason: string;
};

export function createDiscordForumChannel(botToken: string, input: CreateDiscordForumChannelInput) {
  const body: {
    name: string;
    type: number;
    topic: string;
    parent_id?: string;
  } = {
    name: input.name,

    type: DISCORD_GUILD_FORUM_TYPE,

    topic: input.topic,
  };

  if (input.parentId) {
    body.parent_id = input.parentId;
  }

  return discordFetch<DiscordGuildChannel>(botToken, `/guilds/${encodeURIComponent(input.guildId)}/channels`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "X-Audit-Log-Reason": encodeURIComponent(input.auditReason),
    },

    body: JSON.stringify(body),
  });
}
