import { and, asc, eq, ne } from "drizzle-orm";

import { resolveProjectCode } from "../../shared/project-code";

import { createDb } from "../db";

import { formatDisplayDate } from "./format-date";
import { resolvePersonName } from "./person-name";

import { projectDiscordForums, projects, taskAssignees, taskDiscordThreads, taskResources, tasks, users, workspaceDiscordIntegrations } from "../db/schema";

import {
  createDiscordForumThread,
  DiscordApiError,
  DISCORD_PUBLIC_THREAD_TYPE,
  editDiscordMessage,
  getDiscordChannel,
  getDiscordMessage,
  modifyDiscordThread,
  listActiveDiscordGuildThreads,
  listArchivedDiscordPublicThreads,
  type DiscordGuildChannel,
  type DiscordMessage,
} from "./discord-api";
type Db = ReturnType<typeof createDb>;

const PROVISION_LEASE_MS = 60_000;

const MAX_LAST_ERROR_LENGTH = 1_000;

const MAX_DISCORD_MESSAGE_LENGTH = 2_000;

export type ProvisionTaskDiscordThreadResult =
  | {
      status: "skipped";

      reason: "mapping_missing" | "integration_disabled" | "integration_not_connected" | "project_forum_not_ready";
    }
  | {
      status: "busy";

      taskId: string;
    }
  | {
      status: "ready";

      taskId: string;

      guildId: string;

      forumChannelId: string;

      threadId: string;

      initialMessageId: string;

      attemptCount: number;

      recovered: boolean;
    }
  | {
      status: "error";

      taskId: string;

      attemptCount: number;

      message: string;
    };

export type SyncTaskDiscordThreadResult =
  | {
      status: "skipped";

      reason: "mapping_missing" | "mapping_not_ready" | "integration_disabled" | "integration_not_connected" | "project_forum_not_ready";
    }
  | {
      status: "synced";

      taskId: string;

      guildId: string;

      forumChannelId: string;

      threadId: string;

      initialMessageId: string;
    }
  | {
      status: "error";

      taskId: string;

      message: string;
    };
function resolveErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown Discord task thread provisioning error";

  return message.slice(0, MAX_LAST_ERROR_LENGTH);
}

function resolveSyncErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown Discord task message sync error";

  return message.slice(0, MAX_LAST_ERROR_LENGTH);
}

function resolveTaskMarker(taskId: string) {
  return `Flow Task ID: \`${taskId}\``;
}

function resolveTaskThreadName(projectName: string, projectCodeOverride: string | null, taskNumber: number, title: string) {
  const taskCode = `${resolveProjectCode(projectName, projectCodeOverride)}-${taskNumber}`;

  const value = `${taskCode} ${title}`.replace(/\s+/g, " ").trim();

  if (value) {
    return value.slice(0, 100).trim();
  }

  return taskCode;
}

async function buildCanonicalTaskMessage(
  db: Db,
  task: {
    id: string;

    description: string | null;

    status: string;

    priority: string | null;

    leadUserId: string | null;

    startDate: string | null;

    dueDate: string | null;

    updatedAt: Date;
  },
) {
  let lead: {
    discordUserId: string | null;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
  } | null = null;

  if (task.leadUserId) {
    const [resolvedLead] = await db
      .select({
        discordUserId: users.discordUserId,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, task.leadUserId))
      .limit(1);

    lead = resolvedLead ?? null;
  }

  const assignees = await db
    .select({
      discordUserId: users.discordUserId,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(taskAssignees.taskId, task.id))
    .orderBy(asc(taskAssignees.createdAt), asc(taskAssignees.userId));

  const resources = await db
    .select({
      type: taskResources.type,

      title: taskResources.title,

      url: taskResources.url,

      content: taskResources.content,

      position: taskResources.position,
    })
    .from(taskResources)
    .where(eq(taskResources.taskId, task.id))
    .orderBy(asc(taskResources.position));

  const lines: string[] = [];

  if (task.description) {
    lines.push(`Description: ${task.description}`);
  }

  lines.push(`Status: ${task.status}`);

  if (task.priority) {
    lines.push(`Priority: ${task.priority}`);
  }

  if (task.startDate) {
    lines.push(`Start Date: ${formatDisplayDate(task.startDate)}`);
  }

  if (task.dueDate) {
    lines.push(`Due Date: ${formatDisplayDate(task.dueDate)}`);
  }

  if (lead) {
    lines.push(`Lead: ${lead.discordUserId ? `<@${lead.discordUserId}>` : resolvePersonName(lead)}`);
  }

  if (assignees.length > 0) {
    lines.push(`Assigned: ${assignees.map((assignee) => (assignee.discordUserId ? `<@${assignee.discordUserId}>` : resolvePersonName(assignee))).join(", ")}`);
  }

  if (resources.length > 0) {
    const briefs = resources.filter((resource) => resource.type === "document_brief");

    const links = resources.filter((resource) => resource.type === "link");

    const resourceLines: string[] = ["Resources:"];

    if (briefs.length > 0) {
      resourceLines.push("Brief:");

      resourceLines.push(
        ...briefs.map((resource) => {
          const title = resource.title?.trim() || "Brief";

          const content = resource.content?.trim();

          return content ? `- ${title}: ${content}` : `- ${title}`;
        }),
      );
    }

    if (links.length > 0) {
      resourceLines.push("Links:");

      resourceLines.push(
        ...links.map((resource) => {
          const title = resource.title?.trim() || "Link";

          return resource.url ? `- ${title}: ${resource.url}` : `- ${title}`;
        }),
      );
    }

    lines.push(resourceLines.join("\n"));
  }

  const marker = resolveTaskMarker(task.id);

  const suffix = [`Last Updated: ${task.updatedAt.toISOString()}`, marker].join("\n");

  const prefix = lines.join("\n");

  const separator = prefix ? "\n" : "";

  const available = MAX_DISCORD_MESSAGE_LENGTH - suffix.length - separator.length;

  let safePrefix = prefix;

  if (safePrefix.length > available) {
    safePrefix = `${safePrefix.slice(0, Math.max(0, available - 1)).trimEnd()}…`;
  }

  const allowedUserIds = [lead?.discordUserId ?? null, ...assignees.map((assignee) => assignee.discordUserId)].filter((value): value is string => Boolean(value));
  return {
    content: safePrefix ? `${safePrefix}\n${suffix}` : suffix,

    allowedUserIds: [...new Set(allowedUserIds)],
  };
}

async function findExistingTaskThread(botToken: string, guildId: string, forumChannelId: string, marker: string) {
  const [active, archived] = await Promise.all([listActiveDiscordGuildThreads(botToken, guildId), listArchivedDiscordPublicThreads(botToken, forumChannelId)]);

  const candidates = new Map<string, DiscordGuildChannel>();

  for (const thread of [...active.threads, ...archived.threads]) {
    if (thread.type !== DISCORD_PUBLIC_THREAD_TYPE || thread.parent_id !== forumChannelId) {
      continue;
    }

    candidates.set(thread.id, thread);
  }

  const matches: Array<{
    thread: DiscordGuildChannel;

    message: DiscordMessage;
  }> = [];

  for (const thread of candidates.values()) {
    try {
      /*
       * Discord documents that the starter
       * message in a Forum/Media thread has
       * the same ID as the thread itself.
       */
      const message = await getDiscordMessage(botToken, thread.id, thread.id);

      if (message.content.includes(marker)) {
        matches.push({
          thread,
          message,
        });
      }
    } catch (error) {
      /*
       * A deleted starter message is not
       * our recovery candidate.
       */
      if (error instanceof DiscordApiError && error.status === 404) {
        continue;
      }

      throw error;
    }
  }

  if (matches.length > 1) {
    throw new Error("Multiple Discord Forum posts contain the same Flow task marker");
  }

  return matches[0] ?? null;
}

export async function provisionTaskDiscordThread(db: Db, botToken: string, taskId: string): Promise<ProvisionTaskDiscordThreadResult> {
  const [mapping] = await db
    .select({
      taskId: taskDiscordThreads.taskId,

      guildId: taskDiscordThreads.guildId,

      forumChannelId: taskDiscordThreads.forumChannelId,

      threadId: taskDiscordThreads.threadId,

      initialMessageId: taskDiscordThreads.initialMessageId,

      provisioningStatus: taskDiscordThreads.provisioningStatus,

      attemptCount: taskDiscordThreads.attemptCount,

      lastAttemptAt: taskDiscordThreads.lastAttemptAt,

      projectId: tasks.projectId,

      taskNumber: tasks.taskNumber,

      title: tasks.title,

      description: tasks.description,

      status: tasks.status,

      priority: tasks.priority,

      leadUserId: tasks.leadUserId,

      startDate: tasks.startDate,

      dueDate: tasks.dueDate,

      taskUpdatedAt: tasks.updatedAt,

      workspaceId: projects.workspaceId,

      projectName: projects.name,

      projectCodeOverride: projects.projectCodeOverride,
    })
    .from(taskDiscordThreads)
    .innerJoin(tasks, eq(tasks.id, taskDiscordThreads.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(taskDiscordThreads.taskId, taskId))
    .limit(1);

  if (!mapping) {
    return {
      status: "skipped",

      reason: "mapping_missing",
    };
  }

  if (mapping.provisioningStatus === "ready" && mapping.forumChannelId && mapping.threadId && mapping.initialMessageId) {
    return {
      status: "ready",

      taskId,

      guildId: mapping.guildId,

      forumChannelId: mapping.forumChannelId,

      threadId: mapping.threadId,

      initialMessageId: mapping.initialMessageId,

      attemptCount: mapping.attemptCount,

      recovered: false,
    };
  }

  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,
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

  const [projectForum] = await db
    .select({
      guildId: projectDiscordForums.guildId,

      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,
    })
    .from(projectDiscordForums)
    .where(eq(projectDiscordForums.projectId, mapping.projectId))
    .limit(1);

  if (!projectForum || projectForum.provisioningStatus !== "ready" || !projectForum.forumChannelId) {
    return {
      status: "skipped",

      reason: "project_forum_not_ready",
    };
  }

  const currentGuildId = integration.guildId;

  const currentForumChannelId = projectForum.forumChannelId;

  if (projectForum.guildId !== currentGuildId) {
    const message = "Project Discord Forum belongs to a different Discord server";

    await db
      .update(taskDiscordThreads)
      .set({
        provisioningStatus: "error",

        lastError: message,

        updatedAt: new Date(),
      })
      .where(eq(taskDiscordThreads.taskId, taskId));

    return {
      status: "error",

      taskId,

      attemptCount: mapping.attemptCount,

      message,
    };
  }

  if (mapping.threadId && (mapping.guildId !== currentGuildId || (mapping.forumChannelId && mapping.forumChannelId !== currentForumChannelId))) {
    const message = "Task Discord thread mapping belongs to a different Discord parent";

    await db
      .update(taskDiscordThreads)
      .set({
        provisioningStatus: "error",

        lastError: message,

        updatedAt: new Date(),
      })
      .where(eq(taskDiscordThreads.taskId, taskId));

    return {
      status: "error",

      taskId,

      attemptCount: mapping.attemptCount,

      message,
    };
  }

  const now = new Date();

  if (mapping.provisioningStatus === "pending" && mapping.lastAttemptAt && now.getTime() - mapping.lastAttemptAt.getTime() < PROVISION_LEASE_MS) {
    return {
      status: "busy",

      taskId,
    };
  }

  const nextAttemptCount = mapping.attemptCount + 1;

  const [claimed] = await db
    .update(taskDiscordThreads)
    .set({
      guildId: currentGuildId,

      forumChannelId: currentForumChannelId,

      provisioningStatus: "pending",

      attemptCount: nextAttemptCount,

      lastError: null,

      lastAttemptAt: now,

      updatedAt: now,
    })
    .where(
      and(
        eq(taskDiscordThreads.taskId, taskId),

        eq(taskDiscordThreads.attemptCount, mapping.attemptCount),

        ne(taskDiscordThreads.provisioningStatus, "ready"),
      ),
    )
    .returning({
      attemptCount: taskDiscordThreads.attemptCount,
    });

  if (!claimed) {
    const [latest] = await db
      .select({
        guildId: taskDiscordThreads.guildId,

        forumChannelId: taskDiscordThreads.forumChannelId,

        threadId: taskDiscordThreads.threadId,

        initialMessageId: taskDiscordThreads.initialMessageId,

        provisioningStatus: taskDiscordThreads.provisioningStatus,

        attemptCount: taskDiscordThreads.attemptCount,
      })
      .from(taskDiscordThreads)
      .where(eq(taskDiscordThreads.taskId, taskId))
      .limit(1);

    if (latest?.provisioningStatus === "ready" && latest.forumChannelId && latest.threadId && latest.initialMessageId) {
      return {
        status: "ready",

        taskId,

        guildId: latest.guildId,

        forumChannelId: latest.forumChannelId,

        threadId: latest.threadId,

        initialMessageId: latest.initialMessageId,

        attemptCount: latest.attemptCount,

        recovered: false,
      };
    }

    return {
      status: "busy",

      taskId,
    };
  }

  try {
    const threadName = resolveTaskThreadName(mapping.projectName, mapping.projectCodeOverride, mapping.taskNumber, mapping.title);

    const marker = resolveTaskMarker(taskId);

    const canonicalMessage = await buildCanonicalTaskMessage(db, {
      id: taskId,

      description: mapping.description,

      status: mapping.status,

      priority: mapping.priority,

      leadUserId: mapping.leadUserId,

      startDate: mapping.startDate,

      dueDate: mapping.dueDate,

      updatedAt: mapping.taskUpdatedAt,
    });

    let thread: DiscordGuildChannel;

    let initialMessage: DiscordMessage;

    let recovered = false;

    /*
     * attempt_count > 1 means an earlier
     * execution may have crossed the
     * Discord-create → D1-persist crash gap.
     *
     * Search Discord for the stable Flow
     * Task ID marker before creating again.
     */
    if (claimed.attemptCount > 1) {
      const existing = await findExistingTaskThread(botToken, currentGuildId, currentForumChannelId, marker);

      if (existing) {
        thread = existing.thread;

        initialMessage = existing.message;

        recovered = true;
      } else {
        const created = await createDiscordForumThread(botToken, {
          forumChannelId: currentForumChannelId,

          name: threadName,

          content: canonicalMessage.content,

          allowedUserIds: canonicalMessage.allowedUserIds,

          auditReason: `Flow task thread provisioning: ${taskId}`,
        });

        thread = created;

        initialMessage = created.message;
      }
    } else {
      const created = await createDiscordForumThread(botToken, {
        forumChannelId: currentForumChannelId,

        name: threadName,

        content: canonicalMessage.content,

        allowedUserIds: canonicalMessage.allowedUserIds,

        auditReason: `Flow task thread provisioning: ${taskId}`,
      });

      thread = created;

      initialMessage = created.message;
    }

    if (thread.type !== DISCORD_PUBLIC_THREAD_TYPE) {
      throw new Error("Discord returned an unexpected channel type while provisioning the Task Forum Post");
    }

    if (thread.parent_id !== currentForumChannelId) {
      throw new Error("Discord returned a Task thread under an unexpected parent Forum");
    }

    if (!initialMessage.id) {
      throw new Error("Discord did not return the initial Task message ID");
    }

    const readyAt = new Date();

    const [persisted] = await db
      .update(taskDiscordThreads)
      .set({
        guildId: currentGuildId,

        forumChannelId: currentForumChannelId,

        threadId: thread.id,

        initialMessageId: initialMessage.id,

        provisioningStatus: "ready",

        lastError: null,

        updatedAt: readyAt,
      })
      .where(
        and(
          eq(taskDiscordThreads.taskId, taskId),

          eq(taskDiscordThreads.attemptCount, claimed.attemptCount),

          ne(taskDiscordThreads.provisioningStatus, "ready"),
        ),
      )
      .returning({
        threadId: taskDiscordThreads.threadId,

        initialMessageId: taskDiscordThreads.initialMessageId,

        attemptCount: taskDiscordThreads.attemptCount,
      });

    if (!persisted?.threadId || !persisted.initialMessageId) {
      const [latest] = await db
        .select({
          guildId: taskDiscordThreads.guildId,

          forumChannelId: taskDiscordThreads.forumChannelId,

          threadId: taskDiscordThreads.threadId,

          initialMessageId: taskDiscordThreads.initialMessageId,

          provisioningStatus: taskDiscordThreads.provisioningStatus,

          attemptCount: taskDiscordThreads.attemptCount,
        })
        .from(taskDiscordThreads)
        .where(eq(taskDiscordThreads.taskId, taskId))
        .limit(1);

      if (latest?.provisioningStatus === "ready" && latest.forumChannelId && latest.threadId && latest.initialMessageId) {
        return {
          status: "ready",

          taskId,

          guildId: latest.guildId,

          forumChannelId: latest.forumChannelId,

          threadId: latest.threadId,

          initialMessageId: latest.initialMessageId,

          attemptCount: latest.attemptCount,

          recovered,
        };
      }

      return {
        status: "busy",

        taskId,
      };
    }

    return {
      status: "ready",

      taskId,

      guildId: currentGuildId,

      forumChannelId: currentForumChannelId,

      threadId: persisted.threadId,

      initialMessageId: persisted.initialMessageId,

      attemptCount: persisted.attemptCount,

      recovered,
    };
  } catch (cause) {
    const message = resolveErrorMessage(cause);

    await db
      .update(taskDiscordThreads)
      .set({
        provisioningStatus: "error",

        lastError: message,

        updatedAt: new Date(),
      })
      .where(
        and(
          eq(taskDiscordThreads.taskId, taskId),

          eq(taskDiscordThreads.attemptCount, claimed.attemptCount),

          ne(taskDiscordThreads.provisioningStatus, "ready"),
        ),
      );

    return {
      status: "error",

      taskId,

      attemptCount: claimed.attemptCount,

      message,
    };
  }
}

export async function syncTaskDiscordThread(db: Db, botToken: string, taskId: string): Promise<SyncTaskDiscordThreadResult> {
  const [mapping] = await db
    .select({
      taskId: taskDiscordThreads.taskId,

      guildId: taskDiscordThreads.guildId,

      forumChannelId: taskDiscordThreads.forumChannelId,

      threadId: taskDiscordThreads.threadId,

      initialMessageId: taskDiscordThreads.initialMessageId,

      provisioningStatus: taskDiscordThreads.provisioningStatus,

      projectId: tasks.projectId,

      taskNumber: tasks.taskNumber,

      title: tasks.title,

      description: tasks.description,

      status: tasks.status,

      priority: tasks.priority,

      leadUserId: tasks.leadUserId,

      startDate: tasks.startDate,

      dueDate: tasks.dueDate,

      taskUpdatedAt: tasks.updatedAt,

      workspaceId: projects.workspaceId,

      projectName: projects.name,

      projectCodeOverride: projects.projectCodeOverride,
    })
    .from(taskDiscordThreads)
    .innerJoin(tasks, eq(tasks.id, taskDiscordThreads.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(taskDiscordThreads.taskId, taskId))
    .limit(1);

  if (!mapping) {
    return {
      status: "skipped",

      reason: "mapping_missing",
    };
  }

  if (mapping.provisioningStatus !== "ready" || !mapping.forumChannelId || !mapping.threadId || !mapping.initialMessageId) {
    return {
      status: "skipped",

      reason: "mapping_not_ready",
    };
  }

  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,
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

  const [projectForum] = await db
    .select({
      guildId: projectDiscordForums.guildId,

      forumChannelId: projectDiscordForums.forumChannelId,

      provisioningStatus: projectDiscordForums.provisioningStatus,
    })
    .from(projectDiscordForums)
    .where(eq(projectDiscordForums.projectId, mapping.projectId))
    .limit(1);

  if (!projectForum || projectForum.provisioningStatus !== "ready" || !projectForum.forumChannelId) {
    return {
      status: "skipped",

      reason: "project_forum_not_ready",
    };
  }

  if (mapping.guildId !== integration.guildId || projectForum.guildId !== integration.guildId || mapping.forumChannelId !== projectForum.forumChannelId) {
    return {
      status: "error",

      taskId,

      message: "Task Discord thread mapping does not match the current Discord integration",
    };
  }

  try {
    /*
     * Always rebuild from authoritative D1
     * state instead of carrying mutation
     * payloads into Discord.
     */
    const desiredThreadName = resolveTaskThreadName(mapping.projectName, mapping.projectCodeOverride, mapping.taskNumber, mapping.title);

    const currentThread = await getDiscordChannel(botToken, mapping.threadId);

    if (currentThread.id !== mapping.threadId || currentThread.type !== DISCORD_PUBLIC_THREAD_TYPE || currentThread.parent_id !== mapping.forumChannelId) {
      throw new Error("Discord returned an unexpected Task thread while syncing");
    }

    if (currentThread.name !== desiredThreadName) {
      const renamedThread = await modifyDiscordThread(botToken, {
        threadId: mapping.threadId,

        name: desiredThreadName,

        auditReason: `Flow task thread sync: ${taskId}`,
      });

      if (renamedThread.id !== mapping.threadId || renamedThread.type !== DISCORD_PUBLIC_THREAD_TYPE || renamedThread.parent_id !== mapping.forumChannelId || renamedThread.name !== desiredThreadName) {
        throw new Error("Discord returned an unexpected Task thread after renaming");
      }
    }
    const canonicalMessage = await buildCanonicalTaskMessage(db, {
      id: taskId,

      description: mapping.description,

      status: mapping.status,

      priority: mapping.priority,

      leadUserId: mapping.leadUserId,

      startDate: mapping.startDate,

      dueDate: mapping.dueDate,

      updatedAt: mapping.taskUpdatedAt,
    });

    const message = await editDiscordMessage(botToken, {
      channelId: mapping.threadId,

      messageId: mapping.initialMessageId,

      content: canonicalMessage.content,

      allowedUserIds: canonicalMessage.allowedUserIds,
    });

    /*
     * Never silently accept Discord editing
     * a different canonical object.
     */
    if (message.id !== mapping.initialMessageId || message.channel_id !== mapping.threadId) {
      throw new Error("Discord returned an unexpected Task message while syncing");
    }

    return {
      status: "synced",

      taskId,

      guildId: mapping.guildId,

      forumChannelId: mapping.forumChannelId,

      threadId: mapping.threadId,

      initialMessageId: message.id,
    };
  } catch (cause) {
    return {
      status: "error",

      taskId,

      message: resolveSyncErrorMessage(cause),
    };
  }
}
