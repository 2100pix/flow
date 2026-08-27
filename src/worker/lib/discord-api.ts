const DISCORD_API_BASE = "https://discord.com/api/v10";

export const DISCORD_GUILD_CATEGORY_TYPE = 4;

export const DISCORD_GUILD_FORUM_TYPE = 15;
export const DISCORD_PUBLIC_THREAD_TYPE = 11;

type DiscordErrorResponse = {
  code?: number;
  message?: string;

  /*
   * Detail validasi per-field dari Discord,
   * contohnya saat Invalid Form Body (400).
   * Bentuknya bervariasi, jadi hanya
   * di-stringify untuk pesan error
   */
  errors?: unknown;
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
  reactions?: DiscordMessageReaction[];
};

export type DiscordMessageReaction = {
  count: number;
  me: boolean;
  emoji: {
    id: string | null;
    name: string | null;
  };
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
      // SAFETY: this is the I/O boundary for every Discord API response; payloads are not schema-validated here and each caller owns its declared contract.
      body = JSON.parse(text) as T | DiscordErrorResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    // SAFETY: same untrusted payload parsed above; DiscordErrorResponse fields are optional so a mismatch degrades to a generic message.
    const error = body as DiscordErrorResponse | null;

    /*
     * Sertakan detail errors per-field dari
     * Discord bila ada (mis. Invalid Form Body)
     * supaya penyebab kegagalan langsung terlihat
     * di lastError tanpa perlu debugging manual
     */
    let detail = "";

    if (error?.errors) {
      try {
        detail = ` :: ${JSON.stringify(error.errors).slice(0, 500)}`;
      } catch {
        detail = "";
      }
    }

    throw new DiscordApiError(response.status, error?.code ?? null, error?.message ? `Discord API ${response.status}: ${error.message}${detail}` : `Discord API request failed with status ${response.status}${detail}`);
  }

  // SAFETY: on 2xx the payload is trusted to match the contract declared by the calling wrapper function.
  return body as T;
}

export function listDiscordGuildChannels(botToken: string, guildId: string) {
  return discordFetch<DiscordGuildChannel[]>(botToken, `/guilds/${encodeURIComponent(guildId)}/channels`);
}

export type DiscordGuildMember = {
  user: {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
};

export function getDiscordGuildMember(botToken: string, guildId: string, discordUserId: string) {
  return discordFetch<DiscordGuildMember>(botToken, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}`);
}

type CreateDiscordForumChannelInput = {
  guildId: string;
  name: string;
  topic: string;
  parentId: string | null;
  permissionOverwrites?: DiscordOverwrite[];
  auditReason: string;
};

/*
 * Overwrite izin kanal Discord
 * type: 0 = role, 1 = member
 * allow/deny berupa bitmask angka yang
 * diserialisasi Discord sebagai string
 */
export type DiscordOverwrite = {
  id: string;

  type: 0 | 1;

  allow: number;

  deny: number;
};

/*
 * Bitmask izin yang dipakai Flow untuk
 * mengunci akses Forum project
 */
export const DISCORD_VIEW_CHANNEL = 1 << 10;
export const DISCORD_SEND_MESSAGES = 1 << 11;
export const DISCORD_READ_MESSAGE_HISTORY = 1 << 16;

type CreateDiscordForumChannelBody = {
  name: string;
  type: number;
  topic: string;
  parent_id?: string;
  permission_overwrites?: Array<{
    id: string;
    type: 0 | 1;
    allow: string;
    deny: string;
  }>;
};

export function createDiscordForumChannel(botToken: string, input: CreateDiscordForumChannelInput) {
  const body: CreateDiscordForumChannelBody = {
    name: input.name,
    type: DISCORD_GUILD_FORUM_TYPE,
    topic: input.topic,
  };

  if (input.parentId) {
    body.parent_id = input.parentId;
  }

  if (input.permissionOverwrites && input.permissionOverwrites.length > 0) {
    body.permission_overwrites = input.permissionOverwrites.map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: String(overwrite.allow),
      deny: String(overwrite.deny),
    }));
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

/*
 * Mengganti seluruh permission overwrites
 * sebuah kanal (semantik Discord: full
 * replace). Dipakai untuk mengunci/membuka
 * Forum project sesuai visibilitas Flow
 */
export function modifyDiscordChannelOverwrites(botToken: string, input: { channelId: string; overwrites: DiscordOverwrite[]; auditReason: string }) {
  return discordFetch<DiscordGuildChannel>(botToken, `/channels/${encodeURIComponent(input.channelId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",

      "X-Audit-Log-Reason": encodeURIComponent(input.auditReason),
    },

    body: JSON.stringify({
      permission_overwrites: input.overwrites.map((overwrite) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: String(overwrite.allow),
        deny: String(overwrite.deny),
      })),
    }),
  });
}

export type DiscordRole = {
  id: string;

  name: string;
};

// Daftar role di server Discord — untuk dropdown pengaturan integrasi.
export function listDiscordGuildRoles(botToken: string, guildId: string) {
  return discordFetch<DiscordRole[]>(botToken, `/guilds/${encodeURIComponent(guildId)}/roles`);
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
     * archived=false
     *
     * Renaming a Flow Task must never
     * silently reopen an archived
     * Discord thread
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
       * unintended user mentions
       */
      allowed_mentions: {
        parse: [],

        users: input.allowedUserIds,
      },
    }),
  });
}

/*
 * Menambahkan reaksi emoji milik bot
 * pada sebuah pesan. Respons sukses
 * adalah 204 tanpa body, sehingga
 * discordFetch mengembalikan null
 */
export function addDiscordMessageReaction(botToken: string, channelId: string, messageId: string, emoji: string) {
  return discordFetch<null>(botToken, `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}/@me`, {
    method: "PUT",
  });
}

/*
 * Menghapus reaksi milik bot sendiri
 * pada sebuah pesan (endpoint @me).
 */
export function removeDiscordMessageReaction(botToken: string, channelId: string, messageId: string, emoji: string) {
  return discordFetch<null>(botToken, `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}/@me`, {
    method: "DELETE",
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
