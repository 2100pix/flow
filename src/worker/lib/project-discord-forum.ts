import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { builtInRoleDefinitions } from "../../shared/roles";

import { createDb } from "../db";
import { createId } from "../lib/id";

import { discordOutboxEvents, projectDiscordForums, projectMembers, projects, users, workspaceDiscordIntegrations, workspaceMembers, workspaceRolePermissions } from "../db/schema";
import {
  createDiscordForumChannel,
  DISCORD_GUILD_CATEGORY_TYPE,
  DISCORD_GUILD_FORUM_TYPE,
  DISCORD_READ_MESSAGE_HISTORY,
  DISCORD_SEND_MESSAGES,
  DISCORD_VIEW_CHANNEL,
  listDiscordGuildChannels,
  modifyDiscordChannelOverwrites,
  type DiscordOverwrite,
} from "./discord-api";

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

// ════════════════════════════════════════════════════════════════════
//  AKSES FORUM DISCORD — sinkron dengan visibilitas project di Flow
// ════════════════════════════════════════════════════════════════════

const FORUM_ACCESS_BITS = DISCORD_VIEW_CHANNEL | DISCORD_SEND_MESSAGES | DISCORD_READ_MESSAGE_HISTORY;

/*
 * Pola ID Discord (snowflake) yang valid.
 *
 * User seed/demo bisa saja memiliki nilai
 * discord_user_id palsu (mis. "discord_abc").
 * Entri seperti itu DILEWATI — kalau tidak,
 * satu ID buruk akan membuat seluruh
 * permission overwrites ditolak Discord
 * dengan 400 Invalid Form Body, sehingga
 * kanal terlanjur dibuat tapi tetap publik.
 */
const DISCORD_USER_ID_SNOWFLAKE = /^\d{15,21}$/;

/*
 * Rencana akses forum:
 * - private       → kunci total, hanya anggota
 *                   project + pemegang izin
 *                   projects.private.view_all
 * - workspaceRole → kunci, tapi role Discord
 *                   yang dipilih di pengaturan
 *                   integrasi tetap bisa akses
 * - open          → tanpa overwrite (default)
 */
type ForumAccessPlan =
  | {
      mode: "private";

      discordUserIds: string[];
    }
  | {
      mode: "workspaceRole";

      discordRoleId: string;
    }
  | {
      mode: "open";
    };

function buildForumOverwrites(plan: ForumAccessPlan, guildId: string): DiscordOverwrite[] {
  if (plan.mode === "private") {
    return [
      {
        id: guildId,

        type: 0,

        allow: 0,

        deny: FORUM_ACCESS_BITS,
      },

      ...plan.discordUserIds.map((discordUserId) => ({
        id: discordUserId,

        type: 1 as const,

        allow: FORUM_ACCESS_BITS,

        deny: 0,
      })),
    ];
  }

  if (plan.mode === "workspaceRole") {
    return [
      {
        id: guildId,

        type: 0,

        allow: 0,

        deny: FORUM_ACCESS_BITS,
      },

      {
        id: plan.discordRoleId,

        type: 0,

        allow: FORUM_ACCESS_BITS,

        deny: 0,
      },
    ];
  }

  return [];
}

/*
 * Menghitung rencana akses dari data D1.
 * Dipisah dari pemanggilan Discord agar
 * provisioning (channel id belum tersimpan)
 * dan resync (event member/visibility) bisa
 * memakai logika yang sama.
 */
async function resolveForumAccessPlan(db: Db, projectId: string): Promise<ForumAccessPlan> {
  const [context] = await db
    .select({
      visibility: projects.visibility,

      workspaceId: projects.workspaceId,

      workspaceRoleId: workspaceDiscordIntegrations.workspaceRoleId,
    })
    .from(projects)
    .leftJoin(workspaceDiscordIntegrations, eq(workspaceDiscordIntegrations.workspaceId, projects.workspaceId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!context || context.visibility !== "private") {
    if (context?.workspaceRoleId) {
      return {
        mode: "workspaceRole",

        discordRoleId: context.workspaceRoleId,
      };
    }

    return {
      mode: "open",
    };
  }

  /*
   * Anggota project yang punya akun Discord
   * ter-link. Yang belum ter-link dilewati —
   * mereka tetap bisa lewat web Flow.
   */
  const memberRows = await db
    .select({
      discordUserId: users.discordUserId,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), isNotNull(users.discordUserId), sql`${users.discordUserId} GLOB '[0-9]*'`));

  /*
   * Pemegang izin projects.private.view_all:
   * role bawaan (owner/admin) + role kustom
   * yang punya permission tersebut.
   */
  const builtinKeysWithViewAll = builtInRoleDefinitions.filter((role) => role.permissions.includes("projects.private.view_all")).map((role) => role.key);

  const holderRows = await db
    .select({
      discordUserId: users.discordUserId,

      builtinRole: workspaceMembers.role,

      customPermissionKey: workspaceRolePermissions.permissionKey,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .leftJoin(workspaceRolePermissions, eq(workspaceRolePermissions.roleId, workspaceMembers.customRoleId))
    .where(and(eq(workspaceMembers.workspaceId, context.workspaceId), sql`${users.discordUserId} GLOB '[0-9]*'`));

  const allowedDiscordUserIds = new Set<string>();

  for (const member of memberRows) {
    if (!member.discordUserId) {
      continue;
    }

    if (!DISCORD_USER_ID_SNOWFLAKE.test(member.discordUserId)) {
      console.warn("Skipping invalid Discord user id in project forum access", {
        discordUserId: member.discordUserId,
      });

      continue;
    }

    allowedDiscordUserIds.add(member.discordUserId);
  }

  for (const holder of holderRows) {
    if (!holder.discordUserId) {
      continue;
    }

    const isBuiltinHolder = holder.builtinRole !== null && builtinKeysWithViewAll.includes(holder.builtinRole);

    const isCustomHolder = holder.customPermissionKey === "projects.private.view_all";

    if (isBuiltinHolder || isCustomHolder) {
      if (!DISCORD_USER_ID_SNOWFLAKE.test(holder.discordUserId)) {
        console.warn("Skipping invalid Discord user id in project forum access", {
          discordUserId: holder.discordUserId,
        });

        continue;
      }

      allowedDiscordUserIds.add(holder.discordUserId);
    }
  }

  return {
    mode: "private",

    discordUserIds: [...allowedDiscordUserIds],
  };
}

export type ApplyProjectForumAccessResult =
  | {
      status: "skipped";

      reason: "mapping_missing" | "forum_not_ready" | "guild_not_configured";
    }
  | {
      status: "applied";

      projectId: string;

      forumChannelId: string;

      restricted: boolean;
    };

export type ForumAccessSyncEvent = {
  eventId: string;
};

/*
 * Mengantri resync akses untuk SEMUA forum
 * ready di sebuah workspace.
 *
 * Dipakai ketika perubahan global mengubah
 * daftar yang berhak akses — contohnya role
 * seorang member diganti, atau daftar izin
 * custom role disunting.
 *
 * Event tetap pending di D1 bila dispatch
 * pemanggil gagal; sweeper cron memulihkannya.
 */
export async function insertForumAccessSyncForWorkspace(db: Db, workspaceId: string): Promise<ForumAccessSyncEvent[]> {
  const targets = await db
    .select({
      projectId: projectDiscordForums.projectId,
    })
    .from(projectDiscordForums)
    .innerJoin(projects, eq(projects.id, projectDiscordForums.projectId))
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.archivedAt), eq(projectDiscordForums.provisioningStatus, "ready")));

  const events: ForumAccessSyncEvent[] = [];

  const now = new Date();

  for (const target of targets) {
    const eventId = createId("obx");

    /*
     * Hapus dulu event access pending lama untuk
     * project yang sama (unique index pada
     * event_type + aggregate_id).
     *
     * Inilah koalesensi burst: sepuluh perubahan
     * role berturut-turut hanya menyisakan SATU
     * event terbaru per forum — tidak menumpuk
     * panggilan Discord yang redundan.
     */
    const deletePrevious = db.delete(discordOutboxEvents).where(
      and(
        eq(discordOutboxEvents.aggregateId, target.projectId),

        eq(discordOutboxEvents.eventType, "project_forum.access"),

        eq(discordOutboxEvents.status, "pending"),
      ),
    );

    const insertLatest = db.insert(discordOutboxEvents).values({
      id: eventId,

      workspaceId,

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

    await db.batch([deletePrevious, insertLatest]);

    events.push({
      eventId,
    });
  }

  return events;
}

/*
 * Menerapkan rencana akses ke kanal forum
 * yang sudah ready. Dipanggil oleh consumer
 * untuk event project_forum.access.
 */
export async function applyProjectForumAccess(db: Db, botToken: string, projectId: string): Promise<ApplyProjectForumAccessResult> {
  const [mapping] = await db
    .select({
      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,

      guildId: projectDiscordForums.guildId,
    })
    .from(projectDiscordForums)
    .where(eq(projectDiscordForums.projectId, projectId))
    .limit(1);

  if (!mapping) {
    return {
      status: "skipped",

      reason: "mapping_missing",
    };
  }

  if (mapping.provisioningStatus !== "ready" || !mapping.forumChannelId || !mapping.guildId) {
    return {
      status: "skipped",

      reason: "forum_not_ready",
    };
  }

  const plan = await resolveForumAccessPlan(db, projectId);

  await modifyDiscordChannelOverwrites(botToken, {
    channelId: mapping.forumChannelId,

    overwrites: buildForumOverwrites(plan, mapping.guildId),

    auditReason: `Flow project forum access sync: ${projectId}`,
  });

  return {
    status: "applied",

    projectId,

    forumChannelId: mapping.forumChannelId,

    restricted: plan.mode !== "open",
  };
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

    /*
     * Terapkan akses SEBELUM status ready.
     *
     * Kalau penerapan overwrites gagal,
     * provisioning dianggap gagal dan antrean
     * akan mencoba ulang — forum tidak pernah
     * tertinggal dalam keadaan publik.
     */
    const accessPlan = await resolveForumAccessPlan(db, projectId);

    await modifyDiscordChannelOverwrites(botToken, {
      channelId: forum.id,

      overwrites: buildForumOverwrites(accessPlan, currentGuildId),

      auditReason: `Flow project forum provisioning: ${projectId}`,
    });

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
