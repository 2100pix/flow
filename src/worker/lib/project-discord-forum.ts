import { and, eq, ne } from "drizzle-orm";

import { createDb } from "../db";

import { projectDiscordForums, projects, workspaceDiscordIntegrations } from "../db/schema";

import { createDiscordForumChannel, DISCORD_GUILD_CATEGORY_TYPE, DISCORD_GUILD_FORUM_TYPE, listDiscordGuildChannels } from "./discord-api";

type Db = ReturnType<typeof createDb>;

const PROVISION_LEASE_MS = 60_000;

const MAX_LAST_ERROR_LENGTH = 1_000;

export type EnsureProjectDiscordForumResult =
  | {
      status: "skipped";

      reason: "integration_not_configured" | "integration_disabled" | "integration_not_connected";
    }
  | {
      status: "pending";

      projectId: string;

      guildId: string;

      created: boolean;
    }
  | {
      status: "existing";

      projectId: string;

      guildId: string;

      provisioningStatus: "pending" | "ready" | "error";

      forumChannelId: string | null;
    };

export type ProvisionProjectDiscordForumResult =
  | {
      status: "skipped";

      reason: "mapping_missing" | "integration_disabled" | "integration_not_connected";
    }
  | {
      status: "busy";

      projectId: string;
    }
  | {
      status: "ready";

      projectId: string;

      guildId: string;

      forumChannelId: string;

      attemptCount: number;

      recovered: boolean;
    }
  | {
      status: "error";

      projectId: string;

      attemptCount: number;

      message: string;
    };

function resolveDiscordForumName(projectName: string, projectId: string) {
  const normalized = projectName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");

  if (normalized) {
    return normalized;
  }

  return `project-${projectId.replace(/^prj_/, "").slice(0, 12)}`;
}

function resolveDiscordForumMarker(projectId: string) {
  return `Managed by Flow. Project ID: ${projectId}`;
}

function resolveErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown Discord forum provisioning error";

  return message.slice(0, MAX_LAST_ERROR_LENGTH);
}

export async function ensureProjectDiscordForumPending(db: Db, workspaceId: string, projectId: string) {
  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, workspaceId))
    .limit(1);

  if (!integration) {
    return {
      status: "skipped",

      reason: "integration_not_configured",
    } satisfies EnsureProjectDiscordForumResult;
  }

  if (!integration.enabled) {
    return {
      status: "skipped",

      reason: "integration_disabled",
    } satisfies EnsureProjectDiscordForumResult;
  }

  if (!integration.guildId) {
    return {
      status: "skipped",

      reason: "integration_not_connected",
    } satisfies EnsureProjectDiscordForumResult;
  }

  const [existing] = await db
    .select({
      guildId: projectDiscordForums.guildId,

      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,
    })
    .from(projectDiscordForums)
    .where(eq(projectDiscordForums.projectId, projectId))
    .limit(1);

  if (existing) {
    return {
      status: "existing",

      projectId,

      guildId: existing.guildId,

      provisioningStatus: existing.provisioningStatus,

      forumChannelId: existing.forumChannelId,
    } satisfies EnsureProjectDiscordForumResult;
  }

  const now = new Date();

  await db
    .insert(projectDiscordForums)
    .values({
      projectId,

      guildId: integration.guildId,

      forumChannelId: null,

      provisioningStatus: "pending",

      attemptCount: 0,

      lastError: null,

      lastAttemptAt: null,

      createdAt: now,

      updatedAt: now,
    })
    .onConflictDoNothing({
      target: projectDiscordForums.projectId,
    });

  const [mapping] = await db
    .select({
      guildId: projectDiscordForums.guildId,

      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,

      createdAt: projectDiscordForums.createdAt,
    })
    .from(projectDiscordForums)
    .where(eq(projectDiscordForums.projectId, projectId))
    .limit(1);

  if (!mapping) {
    throw new Error("Failed to persist project Discord forum mapping");
  }

  const created = mapping.createdAt.getTime() === now.getTime();

  if (!created || mapping.provisioningStatus !== "pending" || mapping.forumChannelId !== null) {
    return {
      status: "existing",

      projectId,

      guildId: mapping.guildId,

      provisioningStatus: mapping.provisioningStatus,

      forumChannelId: mapping.forumChannelId,
    } satisfies EnsureProjectDiscordForumResult;
  }

  return {
    status: "pending",

    projectId,

    guildId: mapping.guildId,

    created: true,
  } satisfies EnsureProjectDiscordForumResult;
}

export async function provisionProjectDiscordForum(db: Db, botToken: string, projectId: string): Promise<ProvisionProjectDiscordForumResult> {
  const [mapping] = await db
    .select({
      projectId: projectDiscordForums.projectId,

      guildId: projectDiscordForums.guildId,

      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,

      attemptCount: projectDiscordForums.attemptCount,

      lastAttemptAt: projectDiscordForums.lastAttemptAt,

      workspaceId: projects.workspaceId,

      projectName: projects.name,
    })
    .from(projectDiscordForums)
    .innerJoin(projects, eq(projects.id, projectDiscordForums.projectId))
    .where(eq(projectDiscordForums.projectId, projectId))
    .limit(1);

  if (!mapping) {
    return {
      status: "skipped",

      reason: "mapping_missing",
    };
  }

  if (mapping.provisioningStatus === "ready" && mapping.forumChannelId) {
    return {
      status: "ready",

      projectId,

      guildId: mapping.guildId,

      forumChannelId: mapping.forumChannelId,

      attemptCount: mapping.attemptCount,

      recovered: false,
    };
  }

  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,

      projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, mapping.workspaceId))
    .limit(1);

  if (!integration?.enabled) {
    return {
      status: "skipped",

      reason: "integration_disabled",
    };
  }

  if (!integration.guildId) {
    return {
      status: "skipped",

      reason: "integration_not_connected",
    };
  }

  const currentGuildId = integration.guildId;

  if (mapping.guildId !== currentGuildId && mapping.forumChannelId) {
    const message = "Project Discord forum mapping belongs to a different Discord server";

    await db
      .update(projectDiscordForums)
      .set({
        provisioningStatus: "error",

        lastError: message,

        updatedAt: new Date(),
      })
      .where(eq(projectDiscordForums.projectId, projectId));

    return {
      status: "error",

      projectId,

      attemptCount: mapping.attemptCount,

      message,
    };
  }

  if (mapping.guildId !== currentGuildId) {
    await db
      .update(projectDiscordForums)
      .set({
        guildId: currentGuildId,

        updatedAt: new Date(),
      })
      .where(eq(projectDiscordForums.projectId, projectId));
  }

  const now = new Date();

  if (mapping.provisioningStatus === "pending" && mapping.lastAttemptAt && now.getTime() - mapping.lastAttemptAt.getTime() < PROVISION_LEASE_MS) {
    return {
      status: "busy",

      projectId,
    };
  }

  const nextAttemptCount = mapping.attemptCount + 1;

  /*
   * attempt_count is used as a small
   * compare-and-swap guard.
   *
   * Two concurrent executions that read
   * the same mapping cannot both claim
   * the same attempt.
   */
  const [claimed] = await db
    .update(projectDiscordForums)
    .set({
      guildId: currentGuildId,

      provisioningStatus: "pending",

      attemptCount: nextAttemptCount,

      lastError: null,

      lastAttemptAt: now,

      updatedAt: now,
    })
    .where(and(eq(projectDiscordForums.projectId, projectId), eq(projectDiscordForums.attemptCount, mapping.attemptCount), ne(projectDiscordForums.provisioningStatus, "ready")))
    .returning({
      attemptCount: projectDiscordForums.attemptCount,
    });

  if (!claimed) {
    const [latest] = await db
      .select({
        guildId: projectDiscordForums.guildId,

        forumChannelId: projectDiscordForums.forumChannelId,

        provisioningStatus: projectDiscordForums.provisioningStatus,

        attemptCount: projectDiscordForums.attemptCount,
      })
      .from(projectDiscordForums)
      .where(eq(projectDiscordForums.projectId, projectId))
      .limit(1);

    if (latest?.provisioningStatus === "ready" && latest.forumChannelId) {
      return {
        status: "ready",

        projectId,

        guildId: latest.guildId,

        forumChannelId: latest.forumChannelId,

        attemptCount: latest.attemptCount,

        recovered: false,
      };
    }

    return {
      status: "busy",

      projectId,
    };
  }

  try {
    const channels = await listDiscordGuildChannels(botToken, currentGuildId);

    const marker = resolveDiscordForumMarker(projectId);

    /*
     * This is the crash-gap reconciliation
     * guard.
     *
     * If Discord created the Forum but Flow
     * crashed before forum_channel_id was
     * persisted, the retry finds the existing
     * Forum by the stable project marker.
     */
    const matchingForums = channels.filter((channel) => channel.type === DISCORD_GUILD_FORUM_TYPE && channel.topic === marker);

    if (matchingForums.length > 1) {
      throw new Error("Multiple Discord Forum channels contain the same Flow project marker");
    }

    let forum = matchingForums[0];

    const recovered = Boolean(forum);

    if (!forum) {
      if (integration.projectCategoryId) {
        const categoryExists = channels.some((channel) => channel.id === integration.projectCategoryId && channel.type === DISCORD_GUILD_CATEGORY_TYPE);

        if (!categoryExists) {
          throw new Error("Configured Discord project category no longer exists");
        }
      }

      forum = await createDiscordForumChannel(botToken, {
        guildId: currentGuildId,

        name: resolveDiscordForumName(mapping.projectName, projectId),

        topic: marker,

        parentId: integration.projectCategoryId,

        auditReason: `Flow project forum provisioning: ${projectId}`,
      });
    }

    if (forum.type !== DISCORD_GUILD_FORUM_TYPE) {
      throw new Error("Discord returned an unexpected channel type while provisioning the project Forum");
    }

    const readyAt = new Date();

    await db
      .update(projectDiscordForums)
      .set({
        guildId: currentGuildId,

        forumChannelId: forum.id,

        provisioningStatus: "ready",

        lastError: null,

        updatedAt: readyAt,
      })
      .where(eq(projectDiscordForums.projectId, projectId));

    return {
      status: "ready",

      projectId,

      guildId: currentGuildId,

      forumChannelId: forum.id,

      attemptCount: claimed.attemptCount,

      recovered,
    };
  } catch (cause) {
    const message = resolveErrorMessage(cause);

    /*
     * Do not overwrite a ready state if a
     * concurrent/recovery execution already
     * finished successfully.
     */
    await db
      .update(projectDiscordForums)
      .set({
        provisioningStatus: "error",

        lastError: message,

        updatedAt: new Date(),
      })
      .where(and(eq(projectDiscordForums.projectId, projectId), ne(projectDiscordForums.provisioningStatus, "ready")));

    return {
      status: "error",

      projectId,

      attemptCount: claimed.attemptCount,

      message,
    };
  }
}
