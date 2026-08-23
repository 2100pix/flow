const DISCORD_API_BASE = "https://discord.com/api/v10";

export const DISCORD_GUILD_CATEGORY_TYPE = 4;

export const DISCORD_GUILD_FORUM_TYPE = 15;
export const DISCORD_PUBLIC_THREAD_TYPE = 11;

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

export type DiscordMessage = {
  id: string;

  channel_id: string;

  content: string;
};

export type DiscordDmChannel = {
  id: string;

  type: number;
};

type DiscordActiveThreadsResponse = {
  threads: DiscordGuildChannel[];
};

type DiscordArchivedThreadsResponse = {
  threads: DiscordGuildChannel[];

  has_more: boolean;
};

export type DiscordForumThread = DiscordGuildChannel & {
  message: DiscordMessage;
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

export function listActiveDiscordGuildThreads(botToken: string, guildId: string) {
  return discordFetch<DiscordActiveThreadsResponse>(botToken, `/guilds/${encodeURIComponent(guildId)}/threads/active`);
}

export function listArchivedDiscordPublicThreads(botToken: string, forumChannelId: string) {
  return discordFetch<DiscordArchivedThreadsResponse>(botToken, `/channels/${encodeURIComponent(forumChannelId)}/threads/archived/public?limit=100`);
}

export function getDiscordMessage(botToken: string, channelId: string, messageId: string) {
  return discordFetch<DiscordMessage>(botToken, `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`);
}
export function getDiscordChannel(botToken: string, channelId: string) {
  return discordFetch<DiscordGuildChannel>(botToken, `/channels/${encodeURIComponent(channelId)}`);
}

type ModifyDiscordThreadInput = {
  threadId: string;

  name: string;

  auditReason: string;
};

export function modifyDiscordThread(botToken: string, input: ModifyDiscordThreadInput) {
  return discordFetch<DiscordGuildChannel>(botToken, `/channels/${encodeURIComponent(input.threadId)}`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",

      "X-Audit-Log-Reason": encodeURIComponent(input.auditReason),
    },

    /*
     * Intentionally do not send
     * archived=false.
     *
     * Renaming a Flow Task must never
     * silently reopen an archived
     * Discord thread.
     */
    body: JSON.stringify({
      name: input.name,
    }),
  });
}

type CreateDiscordForumThreadInput = {
  forumChannelId: string;

  name: string;

  content: string;

  allowedUserIds: readonly string[];

  auditReason: string;
};

export function createDiscordForumThread(botToken: string, input: CreateDiscordForumThreadInput) {
  return discordFetch<DiscordForumThread>(botToken, `/channels/${encodeURIComponent(input.forumChannelId)}/threads`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "X-Audit-Log-Reason": encodeURIComponent(input.auditReason),
    },

    body: JSON.stringify({
      name: input.name,

      message: {
        content: input.content,

        /*
         * User-generated task text must not
         * be able to trigger @everyone,
         * @here, or arbitrary mentions.
         *
         * Only explicit Flow assignee/lead
         * Discord identities are allowed.
         */
        allowed_mentions: {
          parse: [],

          users: input.allowedUserIds,
        },
      },
    }),
  });
}

type EditDiscordMessageInput = {
  channelId: string;

  messageId: string;

  content: string;

  allowedUserIds: readonly string[];
};

export function editDiscordMessage(botToken: string, input: EditDiscordMessageInput) {
  return discordFetch<DiscordMessage>(botToken, `/channels/${encodeURIComponent(input.channelId)}/messages/${encodeURIComponent(input.messageId)}`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      content: input.content,

      /*
       * Edit Message does not inherit the
       * allowed_mentions rules that were
       * used when the message was created.
       *
       * Keep arbitrary user content from
       * producing @everyone/@here or
       * unintended user mentions.
       */
      allowed_mentions: {
        parse: [],

        users: input.allowedUserIds,
      },
    }),
  });
}

export function createDiscordDmChannel(botToken: string, discordUserId: string) {
  return discordFetch<DiscordDmChannel>(botToken, "/users/@me/channels", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      recipient_id: discordUserId,
    }),
  });
}

export function createDiscordMessage(botToken: string, channelId: string, content: string) {
  return discordFetch<DiscordMessage>(botToken, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      content,

      allowed_mentions: {
        parse: [],
      },
    }),
  });
}
