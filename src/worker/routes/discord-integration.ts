import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  updateDiscordIntegrationSchema,
  updateDiscordProjectCategorySchema,
  updateDiscordReminderSettingsSchema,
  updateDiscordWorkspaceRoleSchema,
  type DiscordCategoriesResponse,
  type DiscordCategoryDto,
  type DiscordIntegrationDto,
  type DiscordIntegrationResponse,
  type DiscordRolesResponse,
} from "../../shared/contracts/discord-integration";
import { createDb } from "../db";
import { discordOutboxEvents, projectDiscordForums, projects, workspaceDiscordIntegrations } from "../db/schema";
import { dispatchDiscordOutboxEvent } from "../lib/discord-outbox";
import { createId } from "../lib/id";
import { requireAuth, requirePermission } from "../middleware/auth";
import { zValidator } from "@hono/zod-validator";
import { taskPrioritySchema, taskStatusSchema } from "../../shared/contracts/tasks";

import type { AppBindings } from "../types/app-env";
import type { AuthContext } from "../types/auth";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_INTEGRATION_STATE_COOKIE = "flow_discord_integration_state";
const DISCORD_BOT_PERMISSIONS = "292057779248";
type DiscordIntegrationTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;

  guild?: {
    id: string;
    name: string;
  };
};

type DiscordGuild = {
  id: string;
  name: string;
};
type DiscordGuildChannel = {
  id: string;
  name: string;
  type: number;
  position: number;
};

const DISCORD_GUILD_CATEGORY_TYPE = 4;
const DISCORD_CHAT_INPUT_COMMAND_TYPE = 1;

const DISCORD_STRING_OPTION_TYPE = 3;
const DISCORD_USER_OPTION_TYPE = 6;

function formatDiscordChoiceName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

type DiscordIntegrationEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const discordIntegrationRoutes = new Hono<DiscordIntegrationEnv>();

function getIntegrationSettingsUrl(status: string) {
  const params = new URLSearchParams({
    section: "integrations",

    discord: status,
  });

  return `/settings?${params.toString()}`;
}

discordIntegrationRoutes.post("/commands/register", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const [integration] = await db
    .select({
      guildId: workspaceDiscordIntegrations.guildId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  if (!integration?.guildId) {
    return c.json(
      {
        error: {
          code: "DISCORD_NOT_CONNECTED",

          message: "Connect a Discord server before registering commands",
        },
      },
      409,
    );
  }

  /*
   * Choices are generated from the same
   * shared Zod enums used by Flow's Task
   * HTTP contracts.
   */
  const commands = [
    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setstatus",

      description: "Update the Flow Task status",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "status",

          description: "New Task status",

          required: true,

          choices: taskStatusSchema.options.map((value) => ({
            name: formatDiscordChoiceName(value),

            value,
          })),
        },
      ],
    },

    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setpriority",

      description: "Update the Flow Task priority",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "priority",

          description: "New Task priority",

          required: true,

          choices: [
            {
              name: "None",
              value: "none",
            },

            ...taskPrioritySchema.options.map((value) => ({
              name: formatDiscordChoiceName(value),

              value,
            })),
          ],
        },
      ],
    },
    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setlead",

      description: "Update the Flow Task lead",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "action",

          description: "Set or clear the Task lead",

          required: true,

          choices: [
            {
              name: "Set",
              value: "set",
            },
            {
              name: "Clear",
              value: "clear",
            },
          ],
        },

        {
          type: DISCORD_USER_OPTION_TYPE,

          name: "user",

          description: "Discord user mapped to the Flow member",

          required: false,
        },
      ],
    },

    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setassign",

      description: "Add or remove a Flow Task assignee",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "action",

          description: "Add or remove an assignee",

          required: true,

          choices: [
            {
              name: "Add",
              value: "add",
            },
            {
              name: "Remove",
              value: "remove",
            },
          ],
        },

        {
          type: DISCORD_USER_OPTION_TYPE,

          name: "user",

          description: "Discord user mapped to the Flow member",

          required: true,
        },
      ],
    },

    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setstartdate",

      description: "Update the Flow Task start date",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "date",

          description: "Date in YYYY-MM-DD format",

          required: true,
        },
      ],
    },

    {
      type: DISCORD_CHAT_INPUT_COMMAND_TYPE,

      name: "setduedate",

      description: "Update or clear the Flow Task due date",

      options: [
        {
          type: DISCORD_STRING_OPTION_TYPE,

          name: "date",

          description: "YYYY-MM-DD or clear",

          required: true,
        },
      ],
    },
  ];

  /*
   * Bulk overwrite the connected Guild's
   * Flow command set.
   *
   * Guild commands are preferred during
   * development because registration is
   * isolated to the connected workspace
   * server.
   */
  const response = await fetch(`${DISCORD_API_BASE}/applications/${encodeURIComponent(c.env.DISCORD_CLIENT_ID)}/guilds/${encodeURIComponent(integration.guildId)}/commands`, {
    method: "PUT",

    headers: {
      Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,

      "Content-Type": "application/json",
    },

    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    console.error("Discord command registration failed", {
      status: response.status,

      guildId: integration.guildId,
    });

    return c.json(
      {
        error: {
          code: "DISCORD_COMMAND_REGISTRATION_FAILED",

          message: "Failed to register Discord commands",
        },
      },
      502,
    );
  }

  // SAFETY: I/O boundary — the application commands response shape is fixed by Discord's documented API contract.
  const registered = (await response.json()) as Array<{
    id: string;

    name: string;
  }>;

  return c.json({
    data: {
      guildId: integration.guildId,

      commands: registered.map((command) => ({
        id: command.id,

        name: command.name,
      })),
    },
  });
});

discordIntegrationRoutes.get("/connect", requireAuth, requirePermission("settings.manage"), (c) => {
  const state = crypto.randomUUID();
  const secure = new URL(c.req.url).protocol === "https:";

  setCookie(c, DISCORD_INTEGRATION_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: 60 * 10,
    path: "/api/integrations/discord",
  });

  const authorizationUrl = new URL("https://discord.com/oauth2/authorize");
  authorizationUrl.searchParams.set("client_id", c.env.DISCORD_CLIENT_ID);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", c.env.DISCORD_INTEGRATION_REDIRECT_URI);
  authorizationUrl.searchParams.set("scope", "bot applications.commands identify");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("permissions", DISCORD_BOT_PERMISSIONS);
  authorizationUrl.searchParams.set("integration_type", "0");
  authorizationUrl.searchParams.set("prompt", "consent");
  return c.redirect(authorizationUrl.toString());
});

discordIntegrationRoutes.get("/callback", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const code = c.req.query("code");

  const state = c.req.query("state");

  const error = c.req.query("error");

  const hintedGuildId = c.req.query("guild_id");

  const storedState = getCookie(c, DISCORD_INTEGRATION_STATE_COOKIE);

  const secure = new URL(c.req.url).protocol === "https:";

  deleteCookie(c, DISCORD_INTEGRATION_STATE_COOKIE, {
    path: "/api/integrations/discord",
    secure,
  });

  if (error) {
    return c.redirect(getIntegrationSettingsUrl("denied"));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return c.redirect(getIntegrationSettingsUrl("invalid_state"));
  }

  const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",

    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },

    body: new URLSearchParams({
      client_id: c.env.DISCORD_CLIENT_ID,

      client_secret: c.env.DISCORD_CLIENT_SECRET,

      grant_type: "authorization_code",

      code,

      redirect_uri: c.env.DISCORD_INTEGRATION_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    return c.redirect(getIntegrationSettingsUrl("token_exchange_failed"));
  }

  // SAFETY: I/O boundary — the OAuth token response shape is fixed by Discord's documented API contract.
  const token = (await tokenResponse.json()) as DiscordIntegrationTokenResponse;

  const guildId = token.guild?.id ?? hintedGuildId;

  if (!guildId) {
    return c.redirect(getIntegrationSettingsUrl("guild_missing"));
  }

  /*
   * Discord explicitly documents
   * callback guild_id as a hint.
   *
   * Verify the bot can actually
   * access the guild before Flow
   * persists the connection.
   */
  const guildResponse = await fetch(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(guildId)}`, {
    headers: {
      Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,
    },
  });

  if (!guildResponse.ok) {
    return c.redirect(getIntegrationSettingsUrl("bot_verification_failed"));
  }

  // SAFETY: I/O boundary — the guild response shape is fixed by Discord's documented API contract.
  const guild = (await guildResponse.json()) as DiscordGuild;

  const db = createDb(c.env.flow_db);

  const [existingGuildConnection] = await db
    .select({
      workspaceId: workspaceDiscordIntegrations.workspaceId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.guildId, guild.id))
    .limit(1);

  if (existingGuildConnection && existingGuildConnection.workspaceId !== auth.workspace.id) {
    return c.redirect(getIntegrationSettingsUrl("guild_already_connected"));
  }

  const [currentIntegration] = await db
    .select({
      guildId: workspaceDiscordIntegrations.guildId,

      projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  const now = new Date();

  const sameGuild = currentIntegration?.guildId === guild.id;

  await db
    .insert(workspaceDiscordIntegrations)
    .values({
      workspaceId: auth.workspace.id,

      enabled: false,

      guildId: guild.id,

      guildName: guild.name,

      projectCategoryId: sameGuild ? currentIntegration.projectCategoryId : null,

      connectedByUserId: auth.user.id,

      connectedAt: now,

      createdAt: now,

      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workspaceDiscordIntegrations.workspaceId,

      set: {
        enabled: false,

        guildId: guild.id,

        guildName: guild.name,

        projectCategoryId: sameGuild ? currentIntegration.projectCategoryId : null,

        connectedByUserId: auth.user.id,

        connectedAt: now,

        updatedAt: now,
      },
    });

  return c.redirect(getIntegrationSettingsUrl("connected"));
});

discordIntegrationRoutes.delete("/", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const now = new Date();

  await db
    .update(workspaceDiscordIntegrations)
    .set({
      enabled: false,

      guildId: null,

      guildName: null,

      projectCategoryId: null,

      connectedByUserId: null,

      connectedAt: null,
      remindersEnabled: false,
      updatedAt: now,
    })
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id));

  const data: DiscordIntegrationDto = {
    enabled: false,

    connectionStatus: "disconnected",

    guild: null,

    projectCategoryId: null,

    workspaceDiscordRoleId: null,

    reminders: {
      enabled: false,

      timeZone: "UTC",

      hourLocal: 9,
    },

    connectedAt: null,
  };

  const response: DiscordIntegrationResponse = {
    data,
  };

  return c.json(response);
});

discordIntegrationRoutes.get("/categories", requireAuth, requirePermission("settings.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const [integration] = await db
    .select({
      guildId: workspaceDiscordIntegrations.guildId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  if (!integration?.guildId) {
    return c.json(
      {
        error: {
          code: "DISCORD_NOT_CONNECTED",

          message: "Connect a Discord server before loading categories",
        },
      },
      409,
    );
  }

  const channelsResponse = await fetch(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(integration.guildId)}/channels`, {
    headers: {
      Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,
    },
  });

  if (!channelsResponse.ok) {
    return c.json(
      {
        error: {
          code: "DISCORD_CHANNELS_FETCH_FAILED",

          message: "Failed to load Discord server channels",
        },
      },
      502,
    );
  }

  // SAFETY: I/O boundary — the guild channels response shape is fixed by Discord's documented API contract.
  const channels = (await channelsResponse.json()) as DiscordGuildChannel[];

  const data: DiscordCategoryDto[] = channels
    .filter((channel) => channel.type === DISCORD_GUILD_CATEGORY_TYPE)
    .map((channel) => ({
      id: channel.id,

      name: channel.name,

      position: channel.position,
    }))
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));

  const response: DiscordCategoriesResponse = {
    data,
  };

  return c.json(response);
});

/*
 * Daftar role di server Discord untuk
 * dropdown "Roles workspace" pada
 * pengaturan integrasi.
 */
discordIntegrationRoutes.get("/roles", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const [integration] = await db
    .select({
      guildId: workspaceDiscordIntegrations.guildId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  if (!integration?.guildId) {
    return c.json(
      {
        error: {
          code: "DISCORD_NOT_CONNECTED",

          message: "Connect a Discord server before loading roles",
        },
      },
      409,
    );
  }

  const rolesResponse = await fetch(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(integration.guildId)}/roles`, {
    headers: {
      Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,
    },
  });

  if (!rolesResponse.ok) {
    return c.json(
      {
        error: {
          code: "DISCORD_ROLES_FETCH_FAILED",

          message: "Failed to load Discord server roles",
        },
      },
      502,
    );
  }

  // SAFETY: I/O boundary — the guild roles response shape is fixed by Discord's documented API contract.
  const roles = (await rolesResponse.json()) as Array<{
    id: string;

    name: string;

    managed: boolean;
  }>;

  const data = roles
    /*
     * @everyone (id === guild id) dan role
     * terkelola bot tidak masuk pilihan.
     */
    .filter((role) => role.id !== integration.guildId && !role.managed)
    .map((role) => ({
      id: role.id,

      name: role.name,
    }));

  const response: DiscordRolesResponse = {
    data,
  };

  return c.json(response);
});

discordIntegrationRoutes.patch(
  "/category",
  requireAuth,
  requirePermission("settings.manage"),
  zValidator("json", updateDiscordProjectCategorySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Invalid Discord project category",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [integration] = await db
      .select({
        enabled: workspaceDiscordIntegrations.enabled,

        guildId: workspaceDiscordIntegrations.guildId,

        guildName: workspaceDiscordIntegrations.guildName,

        workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,

        connectedAt: workspaceDiscordIntegrations.connectedAt,
        remindersEnabled: workspaceDiscordIntegrations.remindersEnabled,

        reminderTimeZone: workspaceDiscordIntegrations.reminderTimeZone,

        reminderHourLocal: workspaceDiscordIntegrations.reminderHourLocal,
      })
      .from(workspaceDiscordIntegrations)
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
      .limit(1);

    if (!integration?.guildId) {
      return c.json(
        {
          error: {
            code: "DISCORD_NOT_CONNECTED",

            message: "Connect a Discord server before selecting a category",
          },
        },
        409,
      );
    }

    if (input.projectCategoryId !== null) {
      const channelsResponse = await fetch(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(integration.guildId)}/channels`, {
        headers: {
          Authorization: `Bot ${c.env.DISCORD_BOT_TOKEN}`,
        },
      });

      if (!channelsResponse.ok) {
        return c.json(
          {
            error: {
              code: "DISCORD_CHANNELS_FETCH_FAILED",

              message: "Failed to verify Discord project category",
            },
          },
          502,
        );
      }

      // SAFETY: I/O boundary — the guild channels response shape is fixed by Discord's documented API contract.
      const channels = (await channelsResponse.json()) as DiscordGuildChannel[];

      const categoryExists = channels.some((channel) => channel.id === input.projectCategoryId && channel.type === DISCORD_GUILD_CATEGORY_TYPE);

      if (!categoryExists) {
        return c.json(
          {
            error: {
              code: "DISCORD_CATEGORY_INVALID",

              message: "The selected Discord category does not exist in the connected server",
            },
          },
          400,
        );
      }
    }

    const now = new Date();

    await db
      .update(workspaceDiscordIntegrations)
      .set({
        projectCategoryId: input.projectCategoryId,

        updatedAt: now,
      })
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id));

    const data: DiscordIntegrationDto = {
      enabled: integration.enabled,

      connectionStatus: "connected",

      guild: integration.guildName
        ? {
            id: integration.guildId,

            name: integration.guildName,
          }
        : null,

      projectCategoryId: input.projectCategoryId,

      workspaceDiscordRoleId: integration.workspaceRoleId ?? null,
      reminders: {
        enabled: integration.remindersEnabled,

        timeZone: integration.reminderTimeZone,

        hourLocal: integration.reminderHourLocal,
      },
      connectedAt: integration.connectedAt?.toISOString() ?? null,
    };

    const response: DiscordIntegrationResponse = {
      data,
    };

    return c.json(response);
  },
);

/*
 * Resync manual seluruh forum project di
 * workspace ini:
 * - forum belum ready → dikirim ulang
 *   provisioning-nya (termasuk pemulihan
 *   kanal yang terlanjur dibuat)
 * - forum sudah ready → cukup disinkronkan
 *   overwrites-nya
 *
 * Berguna setelah perbaikan izin bot,
 * pembersihan data, atau perubahan aturan
 * akses — tanpa menunggu cron sweeper.
 */
discordIntegrationRoutes.post("/resync-forums", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const targets = await db
    .select({
      projectId: projectDiscordForums.projectId,

      provisioningStatus: projectDiscordForums.provisioningStatus,
    })
    .from(projectDiscordForums)
    .innerJoin(projects, eq(projects.id, projectDiscordForums.projectId))
    .where(and(eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

  const now = new Date();

  let queued = 0;

  for (const target of targets) {
    const eventType = target.provisioningStatus === "ready" ? "project_forum.access" : "project_forum.provision";

    const eventId = createId("obx");

    /*
     * Hapus dulu event pending lama untuk
     * pasangan yang sama — tabel outbox punya
     * unique index pada (event_type, aggregate_id).
     * Pola yang sama dengan task_thread.sync.
     */
    const deletePrevious = db.delete(discordOutboxEvents).where(
      and(
        eq(discordOutboxEvents.aggregateId, target.projectId),

        eq(discordOutboxEvents.eventType, eventType),

        eq(discordOutboxEvents.status, "pending"),
      ),
    );

    const insertLatest = db.insert(discordOutboxEvents).values({
      id: eventId,

      workspaceId: auth.workspace.id,

      aggregateType: "project_forum",

      aggregateId: target.projectId,

      eventType,

      status: "pending",

      dispatchAttemptCount: 0,

      lastDispatchError: null,

      dispatchedAt: null,

      createdAt: now,

      updatedAt: now,
    });

    await db.batch([deletePrevious, insertLatest]);

    c.executionCtx.waitUntil(
      dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, eventId).catch(() => undefined),
    );

    queued += 1;
  }

  return c.json({
    data: {
      queued,
    },
  });
});

/*
 * Menyimpan role Discord yang boleh melihat
 * forum project workspace-visible. Setelah
 * tersimpan, semua forum project non-private
 * yang ready di-resync agar role langsung
 * berlaku.
 */
discordIntegrationRoutes.patch(
  "/workspace-role",
  requireAuth,
  requirePermission("settings.manage"),
  zValidator("json", updateDiscordWorkspaceRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Invalid Discord workspace role",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [integration] = await db
      .select({
        enabled: workspaceDiscordIntegrations.enabled,

        guildId: workspaceDiscordIntegrations.guildId,

        guildName: workspaceDiscordIntegrations.guildName,

        projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,

        workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,

        connectedAt: workspaceDiscordIntegrations.connectedAt,
        remindersEnabled: workspaceDiscordIntegrations.remindersEnabled,

        reminderTimeZone: workspaceDiscordIntegrations.reminderTimeZone,

        reminderHourLocal: workspaceDiscordIntegrations.reminderHourLocal,
      })
      .from(workspaceDiscordIntegrations)
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
      .limit(1);

    if (!integration?.guildId) {
      return c.json(
        {
          error: {
            code: "DISCORD_NOT_CONNECTED",

            message: "Connect a Discord server before selecting a workspace role",
          },
        },
        409,
      );
    }

    const now = new Date();

    await db
      .update(workspaceDiscordIntegrations)
      .set({
        workspaceRoleId: input.workspaceDiscordRoleId,

        updatedAt: now,
      })
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id));

    /*
     * Resync akses untuk semua project
     * workspace-visible yang forum-nya ready.
     * Event dibiarkan pending di D1 bila
     * dispatch gagal — sweeper cron memulihkan.
     */
    const syncTargets = await db
      .select({
        projectId: projects.id,
      })
      .from(projects)
      .innerJoin(projectDiscordForums, eq(projectDiscordForums.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, auth.workspace.id),

          eq(projects.visibility, "workspace"),

          isNull(projects.archivedAt),

          eq(projectDiscordForums.provisioningStatus, "ready"),
        ),
      );

    for (const target of syncTargets) {
      const eventId = createId("obx");

      await db.insert(discordOutboxEvents).values({
        id: eventId,

        workspaceId: auth.workspace.id,

        aggregateType: "project_forum",

        aggregateId: target.projectId,

        eventType: "project_forum.access",

        status: "pending",

        dispatchAttemptCount: 0,

        lastDispatchError: null,

        dispatchedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, eventId).catch(() => undefined));
    }

    const data: DiscordIntegrationDto = {
      enabled: integration.enabled,

      connectionStatus: "connected",

      guild: integration.guildName
        ? {
            id: integration.guildId,

            name: integration.guildName,
          }
        : null,

      projectCategoryId: integration.projectCategoryId,

      workspaceDiscordRoleId: input.workspaceDiscordRoleId,
      reminders: {
        enabled: integration.remindersEnabled,

        timeZone: integration.reminderTimeZone,

        hourLocal: integration.reminderHourLocal,
      },
      connectedAt: integration.connectedAt?.toISOString() ?? null,
    };

    const response: DiscordIntegrationResponse = {
      data,
    };

    return c.json(response);
  },
);

discordIntegrationRoutes.patch(
  "/reminders",
  requireAuth,
  requirePermission("settings.manage"),
  zValidator("json", updateDiscordReminderSettingsSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Invalid Discord reminder settings",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    if (!isValidTimeZone(input.timeZone)) {
      return c.json(
        {
          error: {
            code: "INVALID_TIME_ZONE",

            message: "Discord reminder timezone must be a valid IANA timezone",
          },
        },
        400,
      );
    }

    const db = createDb(c.env.flow_db);

    const [integration] = await db
      .select({
        enabled: workspaceDiscordIntegrations.enabled,

        guildId: workspaceDiscordIntegrations.guildId,

        guildName: workspaceDiscordIntegrations.guildName,

        projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,

        workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,

        connectedAt: workspaceDiscordIntegrations.connectedAt,
      })
      .from(workspaceDiscordIntegrations)
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
      .limit(1);

    if (!integration) {
      return c.json(
        {
          error: {
            code: "DISCORD_INTEGRATION_NOT_CONFIGURED",

            message: "Discord integration is not configured",
          },
        },
        409,
      );
    }

    if (input.enabled && !integration.guildId) {
      return c.json(
        {
          error: {
            code: "DISCORD_NOT_CONNECTED",

            message: "Connect a Discord server before enabling deadline reminders",
          },
        },
        409,
      );
    }

    const now = new Date();

    await db
      .update(workspaceDiscordIntegrations)
      .set({
        remindersEnabled: input.enabled,

        reminderTimeZone: input.timeZone,

        reminderHourLocal: input.hourLocal,

        updatedAt: now,
      })
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id));

    const data: DiscordIntegrationDto = {
      enabled: integration.enabled,

      connectionStatus: integration.guildId ? "connected" : "disconnected",

      guild:
        integration.guildId && integration.guildName
          ? {
              id: integration.guildId,

              name: integration.guildName,
            }
          : null,

      projectCategoryId: integration.projectCategoryId,

      workspaceDiscordRoleId: integration.workspaceRoleId ?? null,
      reminders: {
        enabled: input.enabled,

        timeZone: input.timeZone,

        hourLocal: input.hourLocal,
      },

      connectedAt: integration.connectedAt?.toISOString() ?? null,
    };

    const response: DiscordIntegrationResponse = {
      data,
    };

    return c.json(response);
  },
);

discordIntegrationRoutes.patch(
  "/",
  requireAuth,
  requirePermission("settings.manage"),
  zValidator("json", updateDiscordIntegrationSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Invalid Discord integration data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;
    const input = c.req.valid("json");
    const db = createDb(c.env.flow_db);
    const [integration] = await db

      .select({
        guildId: workspaceDiscordIntegrations.guildId,
        guildName: workspaceDiscordIntegrations.guildName,
        projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,
        workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,
        connectedAt: workspaceDiscordIntegrations.connectedAt,
        remindersEnabled: workspaceDiscordIntegrations.remindersEnabled,
        reminderTimeZone: workspaceDiscordIntegrations.reminderTimeZone,
        reminderHourLocal: workspaceDiscordIntegrations.reminderHourLocal,
      })
      .from(workspaceDiscordIntegrations)
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
      .limit(1);

    if (input.enabled && !integration?.guildId) {
      return c.json(
        {
          error: {
            code: "DISCORD_NOT_CONNECTED",

            message: "Connect a Discord server before enabling the integration",
          },
        },
        409,
      );
    }

    if (!integration) {
      return c.json(
        {
          error: {
            code: "DISCORD_INTEGRATION_NOT_CONFIGURED",

            message: "Discord integration is not configured",
          },
        },
        409,
      );
    }

    const now = new Date();

    await db
      .update(workspaceDiscordIntegrations)
      .set({
        enabled: input.enabled,

        updatedAt: now,
      })
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id));

    const data: DiscordIntegrationDto = {
      enabled: input.enabled,

      connectionStatus: integration.guildId ? "connected" : "disconnected",

      guild:
        integration.guildId && integration.guildName
          ? {
              id: integration.guildId,

              name: integration.guildName,
            }
          : null,

      projectCategoryId: integration.projectCategoryId,

      workspaceDiscordRoleId: integration.workspaceRoleId ?? null,
      reminders: {
        enabled: integration.remindersEnabled,

        timeZone: integration.reminderTimeZone,

        hourLocal: integration.reminderHourLocal,
      },
      connectedAt: integration.connectedAt?.toISOString() ?? null,
    };

    const response: DiscordIntegrationResponse = {
      data,
    };

    return c.json(response);
  },
);

discordIntegrationRoutes.get("/", requireAuth, requirePermission("settings.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,

      guildName: workspaceDiscordIntegrations.guildName,

      projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,

      workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,

      connectedAt: workspaceDiscordIntegrations.connectedAt,
      remindersEnabled: workspaceDiscordIntegrations.remindersEnabled,

      reminderTimeZone: workspaceDiscordIntegrations.reminderTimeZone,

      reminderHourLocal: workspaceDiscordIntegrations.reminderHourLocal,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  const data: DiscordIntegrationDto = integration
    ? {
        enabled: integration.enabled,

        connectionStatus: integration.guildId ? "connected" : "disconnected",

        guild:
          integration.guildId && integration.guildName
            ? {
                id: integration.guildId,
                name: integration.guildName,
              }
            : null,

        projectCategoryId: integration.projectCategoryId,

        workspaceDiscordRoleId: integration.workspaceRoleId ?? null,
        reminders: {
          enabled: integration.remindersEnabled,

          timeZone: integration.reminderTimeZone,

          hourLocal: integration.reminderHourLocal,
        },
        connectedAt: integration.connectedAt?.toISOString() ?? null,
      }
    : {
        enabled: false,

        connectionStatus: "disconnected",

        guild: null,

        projectCategoryId: null,

        workspaceDiscordRoleId: null,
        reminders: {
          enabled: false,

          timeZone: "UTC",

          hourLocal: 9,
        },
        connectedAt: null,
      };

  const response: DiscordIntegrationResponse = {
    data,
  };

  return c.json(response);
});
