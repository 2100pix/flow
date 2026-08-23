import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";

import { resolveProjectCode } from "../../shared/project-code";

import { createDb } from "../db";

import { discordOutboxEvents, projects, taskAssignees, taskDiscordReminders, taskDiscordThreads, tasks, users, workspaceDiscordIntegrations, workspaceMembers } from "../db/schema";

import { formatDisplayDate } from "./format-date";
import { createDiscordDmChannel, createDiscordMessage, DiscordApiError } from "./discord-api";

type Db = ReturnType<typeof createDb>;

type ReminderKind = "day_before" | "due_today";

const MAX_REMINDER_ERROR_LENGTH = 1_000;

function resolveLocalClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    hourCycle: "h23",
  }).formatToParts(now);

  const values = new Map(parts.map((part) => [part.type, part.value]));

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  const hour = values.get("hour");

  if (!year || !month || !day || hour === undefined) {
    throw new Error(`Unable to resolve local clock for timezone ${timeZone}`);
  }

  return {
    date: `${year}-${month}-${day}`,

    hour: Number(hour),
  };
}

function addDaysToIsoDate(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return date.toISOString().slice(0, 10);
}

async function resolveStableId(prefix: string, value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${prefix}_${hex.slice(0, 32)}`;
}

async function createReminderIntent(
  db: Db,
  input: {
    workspaceId: string;

    taskId: string;

    userId: string;

    dueDate: string;

    kind: ReminderKind;
  },
) {
  const identity = [input.taskId, input.userId, input.dueDate, input.kind].join(":");

  const reminderId = await resolveStableId("drm", identity);

  const outboxEventId = await resolveStableId("obx", `task_reminder.send:${reminderId}`);

  const now = new Date();

  await db.batch([
    db
      .insert(taskDiscordReminders)
      .values({
        id: reminderId,

        workspaceId: input.workspaceId,

        taskId: input.taskId,

        userId: input.userId,

        dueDate: input.dueDate,

        kind: input.kind,

        deliveryStatus: "pending",

        lastError: null,

        sentAt: null,

        createdAt: now,

        updatedAt: now,
      })
      .onConflictDoNothing(),

    db
      .insert(discordOutboxEvents)
      .values({
        id: outboxEventId,

        workspaceId: input.workspaceId,

        aggregateType: "task_reminder",

        aggregateId: reminderId,

        eventType: "task_reminder.send",

        status: "pending",

        dispatchAttemptCount: 0,

        lastDispatchError: null,

        dispatchedAt: null,

        createdAt: now,

        updatedAt: now,
      })
      .onConflictDoNothing(),
  ]);

  return {
    reminderId,

    outboxEventId,
  };
}

type ReminderWindow = {
  hourReached: boolean;

  dueToday: string;

  dueTomorrow: string;
};

type ReminderCandidate = {
  taskId: string;

  dueDate: string;

  leadUserId: string | null;
};

export async function materializeDiscordTaskReminders(db: Db, now = new Date()) {
  const integrations = await db
    .select({
      workspaceId: workspaceDiscordIntegrations.workspaceId,

      timeZone: workspaceDiscordIntegrations.reminderTimeZone,

      hourLocal: workspaceDiscordIntegrations.reminderHourLocal,
    })
    .from(workspaceDiscordIntegrations)
    .where(
      and(
        eq(workspaceDiscordIntegrations.enabled, true),

        eq(workspaceDiscordIntegrations.remindersEnabled, true),

        isNotNull(workspaceDiscordIntegrations.guildId),
      ),
    );

  let evaluated = 0;

  for (const integration of integrations) {
    /*
     * Each recipient gets reminders on their own local
     * clock. Users without a personal time zone fall back
     * to the workspace reminder time zone.
     */
    const memberRows = await db
      .select({
        userId: workspaceMembers.userId,

        timeZone: users.timeZone,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, integration.workspaceId));

    const zoneByUserId = new Map<string, string>();

    const userIdsByZone = new Map<string, Set<string>>();

    for (const member of memberRows) {
      const zone = member.timeZone?.trim() || integration.timeZone;

      zoneByUserId.set(member.userId, zone);

      const bucket = userIdsByZone.get(zone);

      if (bucket) {
        bucket.add(member.userId);
      } else {
        userIdsByZone.set(
          zone,
          new Set([member.userId]),
        );
      }
    }

    const windowsByZone = new Map<string, ReminderWindow>();

    const candidatesByDateRange = new Map<string, ReminderCandidate[]>();

    for (const [zone] of userIdsByZone) {
      let window = windowsByZone.get(zone);

      if (!window) {
        const local = resolveLocalClock(now, zone);

        /*
         * Running after the configured hour is
         * intentional.
         *
         * It gives the 5-minute cron a same-day
         * catch-up window after temporary Worker
         * or Queue downtime.
         */
        window = {
          hourReached: local.hour >= integration.hourLocal,

          dueToday: local.date,

          dueTomorrow: addDaysToIsoDate(local.date, 1),
        };

        windowsByZone.set(zone, window);
      }

      if (!window.hourReached) {
        continue;
      }

      const rangeKey = `${window.dueToday}:${window.dueTomorrow}`;

      let candidates = candidatesByDateRange.get(rangeKey);

      if (!candidates) {
        const rows = await db
          .select({
            taskId: tasks.id,

            dueDate: tasks.dueDate,

            leadUserId: tasks.leadUserId,
          })
          .from(tasks)
          .innerJoin(projects, eq(projects.id, tasks.projectId))
          .where(
            and(
              eq(projects.workspaceId, integration.workspaceId),

              isNull(projects.archivedAt),

              isNull(tasks.archivedAt),

              ne(tasks.status, "done"),

              ne(tasks.status, "cancelled"),

              isNotNull(tasks.dueDate),

              inArray(tasks.dueDate, [window.dueToday, window.dueTomorrow]),
            ),
          );

        candidates = rows.map((row) => ({
          taskId: row.taskId,

          dueDate: row.dueDate ?? "",

          leadUserId: row.leadUserId,
        }));

        candidatesByDateRange.set(rangeKey, candidates);
      }

      for (const task of candidates) {
        if (!task.dueDate) {
          continue;
        }

        const assignees = await db
          .select({
            userId: taskAssignees.userId,
          })
          .from(taskAssignees)
          .where(eq(taskAssignees.taskId, task.taskId));

        const recipientIds = new Set<string>();

        if (task.leadUserId) {
          recipientIds.add(task.leadUserId);
        }

        for (const assignee of assignees) {
          recipientIds.add(assignee.userId);
        }

        if (recipientIds.size === 0) {
          continue;
        }

        const zoneRecipients = [...recipientIds].filter((userId) => (zoneByUserId.get(userId) ?? integration.timeZone) === zone);

        if (zoneRecipients.length === 0) {
          continue;
        }

        const kind: ReminderKind = task.dueDate === window.dueToday ? "due_today" : "day_before";

        for (const userId of zoneRecipients) {
          await createReminderIntent(db, {
            workspaceId: integration.workspaceId,

            taskId: task.taskId,

            userId,

            dueDate: task.dueDate,

            kind,
          });

          evaluated += 1;
        }
      }
    }
  }

  return {
    evaluated,
  };
}

function resolveReminderError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Discord reminder delivery error";

  return message.slice(0, MAX_REMINDER_ERROR_LENGTH);
}

async function cancelReminder(db: Db, reminderId: string, reason: string) {
  await db
    .update(taskDiscordReminders)
    .set({
      deliveryStatus: "cancelled",

      lastError: reason.slice(0, MAX_REMINDER_ERROR_LENGTH),

      updatedAt: new Date(),
    })
    .where(eq(taskDiscordReminders.id, reminderId));
}

export type DeliverDiscordTaskReminderResult =
  | {
      status: "sent";

      reminderId: string;
    }
  | {
      status: "cancelled";

      reminderId: string;

      reason: string;
    }
  | {
      status: "error";

      reminderId: string;

      message: string;
    };

export async function deliverDiscordTaskReminder(db: Db, botToken: string, reminderId: string, now = new Date()): Promise<DeliverDiscordTaskReminderResult> {
  const [reminder] = await db
    .select({
      id: taskDiscordReminders.id,

      workspaceId: taskDiscordReminders.workspaceId,

      taskId: taskDiscordReminders.taskId,

      userId: taskDiscordReminders.userId,

      dueDate: taskDiscordReminders.dueDate,

      kind: taskDiscordReminders.kind,

      deliveryStatus: taskDiscordReminders.deliveryStatus,

      discordUserId: users.discordUserId,

      userTimeZone: users.timeZone,

      taskTitle: tasks.title,

      taskNumber: tasks.taskNumber,

      taskDueDate: tasks.dueDate,

      taskStatus: tasks.status,

      taskArchivedAt: tasks.archivedAt,

      taskLeadUserId: tasks.leadUserId,

      projectId: projects.id,

      projectName: projects.name,

      projectCodeOverride: projects.projectCodeOverride,

      projectArchivedAt: projects.archivedAt,

      threadGuildId: taskDiscordThreads.guildId,

      threadId: taskDiscordThreads.threadId,

      timeZone: workspaceDiscordIntegrations.reminderTimeZone,

      hourLocal: workspaceDiscordIntegrations.reminderHourLocal,

      integrationEnabled: workspaceDiscordIntegrations.enabled,

      remindersEnabled: workspaceDiscordIntegrations.remindersEnabled,

      integrationGuildId: workspaceDiscordIntegrations.guildId,
    })
    .from(taskDiscordReminders)
    .innerJoin(tasks, eq(tasks.id, taskDiscordReminders.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(users, eq(users.id, taskDiscordReminders.userId))
    .innerJoin(workspaceDiscordIntegrations, eq(workspaceDiscordIntegrations.workspaceId, taskDiscordReminders.workspaceId))
    .leftJoin(taskDiscordThreads, eq(taskDiscordThreads.taskId, taskDiscordReminders.taskId))
    .where(eq(taskDiscordReminders.id, reminderId))
    .limit(1);

  if (!reminder) {
    return {
      status: "cancelled",

      reminderId,

      reason: "reminder_missing",
    };
  }

  if (reminder.deliveryStatus === "sent") {
    return {
      status: "sent",

      reminderId,
    };
  }

  if (reminder.deliveryStatus === "cancelled") {
    return {
      status: "cancelled",

      reminderId,

      reason: "already_cancelled",
    };
  }

  if (!reminder.integrationEnabled || !reminder.remindersEnabled || !reminder.integrationGuildId) {
    await cancelReminder(db, reminderId, "Discord deadline reminders are disabled");

    return {
      status: "cancelled",

      reminderId,

      reason: "reminders_disabled",
    };
  }

  if (reminder.taskArchivedAt || reminder.projectArchivedAt || reminder.taskStatus === "done" || reminder.taskStatus === "cancelled" || reminder.taskDueDate !== reminder.dueDate) {
    await cancelReminder(db, reminderId, "Task is no longer eligible for this reminder");

    return {
      status: "cancelled",

      reminderId,

      reason: "task_no_longer_eligible",
    };
  }

  const assignee = await db
    .select({
      userId: taskAssignees.userId,
    })
    .from(taskAssignees)
    .where(
      and(
        eq(taskAssignees.taskId, reminder.taskId),

        eq(taskAssignees.userId, reminder.userId),
      ),
    )
    .limit(1);

  const stillRecipient = reminder.taskLeadUserId === reminder.userId || assignee.length > 0;

  if (!stillRecipient) {
    await cancelReminder(db, reminderId, "User is no longer a Task lead or assignee");

    return {
      status: "cancelled",

      reminderId,

      reason: "recipient_no_longer_eligible",
    };
  }

  const effectiveZone = reminder.userTimeZone?.trim() || reminder.timeZone;

  const local = resolveLocalClock(now, effectiveZone);

  const expectedDate = reminder.kind === "due_today" ? reminder.dueDate : addDaysToIsoDate(reminder.dueDate, -1);

  if (local.date !== expectedDate || local.hour < reminder.hourLocal) {
    await cancelReminder(db, reminderId, "Reminder delivery window has expired");

    return {
      status: "cancelled",

      reminderId,

      reason: "delivery_window_expired",
    };
  }

  const taskCode = `${resolveProjectCode(reminder.projectName, reminder.projectCodeOverride)}-${reminder.taskNumber}`;

  const timing = reminder.kind === "due_today" ? "is due today" : "is due tomorrow";

  const lines = [`Flow reminder: ${taskCode} ${timing}.`, reminder.taskTitle, `Due Date: ${formatDisplayDate(reminder.dueDate)}`];

  if (reminder.threadGuildId && reminder.threadId) {
    lines.push(`Discord Task: https://discord.com/channels/${reminder.threadGuildId}/${reminder.threadId}`);
  }

  try {
    const dm = await createDiscordDmChannel(botToken, reminder.discordUserId);

    await createDiscordMessage(botToken, dm.id, lines.join("\n"));

    const sentAt = new Date();

    await db
      .update(taskDiscordReminders)
      .set({
        deliveryStatus: "sent",

        lastError: null,

        sentAt,

        updatedAt: sentAt,
      })
      .where(
        and(
          eq(taskDiscordReminders.id, reminderId),

          eq(taskDiscordReminders.deliveryStatus, "pending"),
        ),
      );

    return {
      status: "sent",

      reminderId,
    };
  } catch (error) {
    const message = resolveReminderError(error);

    /*
     * 403 is normally a user-level DM
     * restriction such as closed DMs.
     *
     * Retrying it every five minutes would
     * create permanent queue churn.
     */
    if (error instanceof DiscordApiError && error.status === 403) {
      await cancelReminder(db, reminderId, message);

      return {
        status: "cancelled",

        reminderId,

        reason: "discord_dm_forbidden",
      };
    }

    await db
      .update(taskDiscordReminders)
      .set({
        lastError: message,

        updatedAt: new Date(),
      })
      .where(eq(taskDiscordReminders.id, reminderId));

    return {
      status: "error",

      reminderId,

      message,
    };
  }
}
