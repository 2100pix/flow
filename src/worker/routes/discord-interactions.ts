import { and, asc, eq, isNull, max } from "drizzle-orm";
import { Hono } from "hono";

import { taskDateSchema, taskPrioritySchema, taskStatusSchema, type TaskPriority, type TaskStatus } from "../../shared/contracts/tasks";
import { parsePermissionKeys, type PermissionKey } from "../../shared/permissions";
import { builtInRoleDefinitions } from "../../shared/roles";
import { canViewProject, type ProjectVisibility } from "../../shared/project-privacy";

import { createDb } from "../db";
import { discordOutboxEvents, projectMembers, projectTaskStatuses, projects, taskAssignees, taskDiscordThreads, tasks, users, workspaceDiscordIntegrations, workspaceMembers, workspaceRolePermissions, workspaceRoles } from "../db/schema";
import { dispatchDiscordOutboxEvent } from "../lib/discord-outbox";
import { createId } from "../lib/id";
import type { AppBindings } from "../types/app-env";

type DiscordInteractionEnv = {
  Bindings: AppBindings;
};

export const discordInteractionRoutes = new Hono<DiscordInteractionEnv>();

const DISCORD_INTERACTION_PING = 1;
const DISCORD_INTERACTION_APPLICATION_COMMAND = 2;

const DISCORD_RESPONSE_PONG = 1;
const DISCORD_RESPONSE_CHANNEL_MESSAGE = 4;

const DISCORD_MESSAGE_FLAG_EPHEMERAL = 64;

type DiscordCommandOption = {
  name: string;
  type: number;

  value?: string | number | boolean;

  options?: DiscordCommandOption[];
};

type DiscordInteraction = {
  id: string;

  application_id: string;

  type: number;

  guild_id?: string;

  channel_id?: string;

  member?: {
    user?: {
      id: string;
    };
  };

  data?: {
    id?: string;

    name?: string;

    type?: number;

    options?: DiscordCommandOption[];
  };
};

type DiscordTaskContext =
  | {
      status: "integration_unavailable";
    }
  | {
      status: "task_mapping_missing";
    }
  | {
      status: "ready";

      workspaceId: string;

      taskId: string;

      projectId: string;

      projectVisibility: ProjectVisibility;
    };

type DiscordActorResult =
  | {
      status: "missing";
    }
  | {
      status: "integrity_error";
    }
  | {
      status: "ready";

      userId: string;

      permissions: PermissionKey[];
    };

type DiscordTaskMutation =
  | {
      kind: "status";
      value: TaskStatus;
    }
  | {
      kind: "priority";
      value: TaskPriority | null;
    }
  | {
      kind: "lead";
      value: string | null;
    }
  | {
      kind: "start_date";
      value: string;
    }
  | {
      kind: "due_date";
      value: string | null;
    };

type DiscordAssigneeAction = "add" | "remove";

function hexToBytes(value: string) {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error("Invalid hexadecimal value");
  }

  const result = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    result[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return result;
}

async function verifyDiscordInteractionSignature(publicKeyHex: string, signatureHex: string, timestamp: string, body: string) {
  try {
    const publicKeyBytes = hexToBytes(publicKeyHex);

    const signatureBytes = hexToBytes(signatureHex);

    /*
     * Ed25519 keys/signatures have fixed
     * sizes. Reject malformed requests
     * before invoking WebCrypto.
     */
    if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      {
        name: "Ed25519",
      },
      false,
      ["verify"],
    );

    const message = new TextEncoder().encode(`${timestamp}${body}`);

    return crypto.subtle.verify(
      {
        name: "Ed25519",
      },
      key,
      signatureBytes,
      message,
    );
  } catch {
    return false;
  }
}

function interactionMessage(content: string) {
  return {
    type: DISCORD_RESPONSE_CHANNEL_MESSAGE,

    data: {
      content,

      flags: DISCORD_MESSAGE_FLAG_EPHEMERAL,

      /*
       * No Interaction response generated
       * by Flow may trigger arbitrary
       * mentions.
       */
      allowed_mentions: {
        parse: [],
      },
    },
  };
}

function findStringOption(interaction: DiscordInteraction, name: string) {
  const option = interaction.data?.options?.find((item) => item.name === name);

  return typeof option?.value === "string" ? option.value : null;
}

async function resolveDiscordTaskContext(db: ReturnType<typeof createDb>, guildId: string, channelId: string): Promise<DiscordTaskContext> {
  const [integration] = await db
    .select({
      workspaceId: workspaceDiscordIntegrations.workspaceId,
    })
    .from(workspaceDiscordIntegrations)
    .where(and(eq(workspaceDiscordIntegrations.guildId, guildId), eq(workspaceDiscordIntegrations.enabled, true)))
    .limit(1);

  if (!integration) {
    return {
      status: "integration_unavailable",
    };
  }

  /*
   * channel_id must be the exact mapped
   * Discord Task thread.
   *
   * Forum parent channels or arbitrary
   * Discord channels are rejected.
   */
  const [mapping] = await db
    .select({
      taskId: taskDiscordThreads.taskId,

      projectId: tasks.projectId,

      workspaceId: projects.workspaceId,

      projectVisibility: projects.visibility,
    })
    .from(taskDiscordThreads)
    .innerJoin(tasks, eq(tasks.id, taskDiscordThreads.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(taskDiscordThreads.guildId, guildId),
        eq(taskDiscordThreads.threadId, channelId),
        eq(taskDiscordThreads.provisioningStatus, "ready"),
        eq(projects.workspaceId, integration.workspaceId),
        isNull(projects.archivedAt),
        isNull(tasks.archivedAt),
      ),
    )
    .limit(1);

  if (!mapping) {
    return {
      status: "task_mapping_missing",
    };
  }

  return {
    status: "ready",

    workspaceId: mapping.workspaceId,

    taskId: mapping.taskId,

    projectId: mapping.projectId,

    projectVisibility: mapping.projectVisibility,
  };
}

async function resolveDiscordActor(db: ReturnType<typeof createDb>, workspaceId: string, discordUserId: string): Promise<DiscordActorResult> {
  /*
   * Discord roles are deliberately not
   * authorization.
   *
   * Identity comes from users.discordUserId
   * and authorization comes from Flow's
   * workspace membership + role model.
   */
  const [membership] = await db
    .select({
      userId: users.id,

      role: workspaceMembers.role,

      customRoleId: workspaceMembers.customRoleId,
    })
    .from(users)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .where(eq(users.discordUserId, discordUserId))
    .limit(1);

  if (!membership) {
    return {
      status: "missing",
    };
  }

  const builtInRole = builtInRoleDefinitions.find((role) => role.key === membership.role);

  if (!builtInRole) {
    return {
      status: "integrity_error",
    };
  }

  let permissions: PermissionKey[] = [...builtInRole.permissions];

  if (membership.customRoleId) {
    const roleRows = await db
      .select({
        id: workspaceRoles.id,

        permissionKey: workspaceRolePermissions.permissionKey,
      })
      .from(workspaceRoles)
      .leftJoin(workspaceRolePermissions, eq(workspaceRolePermissions.roleId, workspaceRoles.id))
      .where(and(eq(workspaceRoles.id, membership.customRoleId), eq(workspaceRoles.workspaceId, workspaceId)));

    if (roleRows.length === 0) {
      return {
        status: "integrity_error",
      };
    }

    const rawPermissionKeys = roleRows.length === 1 && roleRows[0].permissionKey === null ? [] : roleRows.map((row) => row.permissionKey);

    const parsedPermissions = parsePermissionKeys(rawPermissionKeys);

    if (!parsedPermissions) {
      return {
        status: "integrity_error",
      };
    }

    /*
     * Mirror normal Flow auth:
     * custom Member roles replace the
     * base Member permission set.
     */
    if (membership.role === "member") {
      permissions = parsedPermissions;
    }
  }

  return {
    status: "ready",

    userId: membership.userId,

    permissions,
  };
}

async function canDiscordActorAccessProject(db: ReturnType<typeof createDb>, projectId: string, visibility: ProjectVisibility, actorUserId: string, permissions: readonly PermissionKey[]) {
  let isProjectMember = false;

  if (visibility === "private") {
    const [membership] = await db
      .select({
        userId: projectMembers.userId,
      })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, actorUserId)))
      .limit(1);

    isProjectMember = Boolean(membership);
  }

  return canViewProject({
    permissions,
    visibility,
    isProjectMember,
  });
}

async function resolveDiscordProjectMember(db: ReturnType<typeof createDb>, workspaceId: string, projectId: string, discordUserId: string) {
  const [member] = await db
    .select({
      userId: users.id,

      displayName: users.displayName,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .where(and(eq(projectMembers.projectId, projectId), eq(users.discordUserId, discordUserId)))
    .limit(1);

  return member ?? null;
}

async function persistDiscordAssigneeMutation(db: ReturnType<typeof createDb>, workspaceId: string, projectId: string, taskId: string, targetUserId: string, action: DiscordAssigneeAction) {
  const currentAssignments = await db
    .select({
      userId: taskAssignees.userId,

      createdAt: taskAssignees.createdAt,
    })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId))
    .orderBy(asc(taskAssignees.createdAt), asc(taskAssignees.userId));

  const alreadyAssigned = currentAssignments.some((assignment) => assignment.userId === targetUserId);

  if (action === "add" && alreadyAssigned) {
    return {
      changed: false,
      eventId: null,
    } as const;
  }

  if (action === "remove" && !alreadyAssigned) {
    return {
      changed: false,
      eventId: null,
    } as const;
  }

  const now = new Date();

  const remainingAssignments = action === "remove" ? currentAssignments.filter((assignment) => assignment.userId !== targetUserId) : currentAssignments;

  const legacyAssigneeId = action === "add" ? (currentAssignments[0]?.userId ?? targetUserId) : (remainingAssignments[0]?.userId ?? null);

  const syncIntent = createDiscordTaskSyncIntent(db, workspaceId, taskId, now);

  const taskUpdate = db
    .update(tasks)
    .set({
      assigneeId: legacyAssigneeId,

      updatedAt: now,
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));

  if (action === "add") {
    const assignmentInsert = db.insert(taskAssignees).values({
      taskId,

      userId: targetUserId,

      createdAt: now,
    });

    await db.batch([taskUpdate, assignmentInsert, syncIntent.deletePrevious, syncIntent.insertLatest]);
  } else {
    const assignmentDelete = db.delete(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, targetUserId)));

    await db.batch([taskUpdate, assignmentDelete, syncIntent.deletePrevious, syncIntent.insertLatest]);
  }

  return {
    changed: true,
    eventId: syncIntent.eventId,
  } as const;
}

function createDiscordTaskSyncIntent(db: ReturnType<typeof createDb>, workspaceId: string, taskId: string, now: Date) {
  const eventId = createId("obx");

  return {
    eventId,

    deletePrevious: db.delete(discordOutboxEvents).where(and(eq(discordOutboxEvents.aggregateId, taskId), eq(discordOutboxEvents.eventType, "task_thread.sync"))),

    insertLatest: db.insert(discordOutboxEvents).values({
      id: eventId,

      workspaceId,

      aggregateType: "task_thread",

      aggregateId: taskId,

      eventType: "task_thread.sync",

      status: "pending",

      dispatchAttemptCount: 0,

      lastDispatchError: null,

      dispatchedAt: null,

      createdAt: now,

      updatedAt: now,
    }),
  };
}

async function persistDiscordTaskMutation(db: ReturnType<typeof createDb>, workspaceId: string, projectId: string, taskId: string, mutation: DiscordTaskMutation) {
  const now = new Date();
  const syncIntent = createDiscordTaskSyncIntent(db, workspaceId, taskId, now);

  let nextSortOrder: number | undefined;

  if (mutation.kind === "status") {
    const [currentTask] = await db
      .select({
        status: tasks.status,

        sortOrder: tasks.sortOrder,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
      .limit(1);

    if (!currentTask) {
      throw new Error("Discord Task mutation target no longer exists");
    }

    if (currentTask.status !== mutation.value) {
      const [position] = await db
        .select({
          maxSortOrder: max(tasks.sortOrder),
        })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, mutation.value), isNull(tasks.archivedAt)));

      nextSortOrder = (position?.maxSortOrder ?? 0) + 100;
    }
  }
  const updateValues =
    mutation.kind === "status"
      ? {
          status: mutation.value,

          ...(nextSortOrder !== undefined
            ? {
                sortOrder: nextSortOrder,
              }
            : {}),

          updatedAt: now,
        }
      : mutation.kind === "priority"
        ? {
            priority: mutation.value,

            updatedAt: now,
          }
        : mutation.kind === "lead"
          ? {
              leadUserId: mutation.value,

              updatedAt: now,
            }
          : mutation.kind === "start_date"
            ? {
                startDate: mutation.value,

                updatedAt: now,
              }
            : {
                dueDate: mutation.value,

                updatedAt: now,
              };

  const taskUpdate = db
    .update(tasks)
    .set(updateValues)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));

  /*
   * Same fresh-event-ID coalescing rule
   * used by Flow-originated mutations.
   *
   * Old queued payloads reference an old
   * outbox ID and cannot overwrite this
   * latest intent.
   */
  await db.batch([taskUpdate, syncIntent.deletePrevious, syncIntent.insertLatest]);

  return syncIntent.eventId;
}

discordInteractionRoutes.post("/", async (c) => {
  const signature = c.req.header("X-Signature-Ed25519");

  const timestamp = c.req.header("X-Signature-Timestamp");

  /*
   * Signature verification must use the
   * exact request body before JSON parsing.
   */
  const rawBody = await c.req.text();

  if (!signature || !timestamp || !(await verifyDiscordInteractionSignature(c.env.DISCORD_PUBLIC_KEY, signature, timestamp, rawBody))) {
    return c.text("invalid request signature", 401);
  }

  let interaction: DiscordInteraction;

  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return c.json(
      {
        error: {
          code: "INVALID_DISCORD_INTERACTION",

          message: "Invalid Discord interaction payload",
        },
      },
      400,
    );
  }

  if (interaction.application_id && interaction.application_id !== c.env.DISCORD_CLIENT_ID) {
    return c.text("invalid application", 401);
  }

  if (interaction.type === DISCORD_INTERACTION_PING) {
    return c.json({
      type: DISCORD_RESPONSE_PONG,
    });
  }

  if (interaction.type !== DISCORD_INTERACTION_APPLICATION_COMMAND) {
    return c.json(interactionMessage("Unsupported Flow interaction."));
  }

  const commandName = interaction.data?.name;

  if (commandName !== "setstatus" && commandName !== "setpriority" && commandName !== "setlead" && commandName !== "setassign" && commandName !== "setstartdate" && commandName !== "setduedate") {
    return c.json(interactionMessage("Unsupported Flow command."));
  }

  const guildId = interaction.guild_id;

  const channelId = interaction.channel_id;

  const discordUserId = interaction.member?.user?.id;

  if (!guildId || !channelId || !discordUserId) {
    return c.json(interactionMessage("Flow Task commands only work inside a connected Discord server."));
  }

  const db = createDb(c.env.flow_db);

  const taskContext = await resolveDiscordTaskContext(db, guildId, channelId);

  if (taskContext.status === "integration_unavailable") {
    return c.json(interactionMessage("Discord integration is not active for this server."));
  }

  if (taskContext.status === "task_mapping_missing") {
    return c.json(interactionMessage("This command only works inside a Flow-managed Task Forum Post."));
  }

  const actor = await resolveDiscordActor(db, taskContext.workspaceId, discordUserId);

  if (actor.status === "missing") {
    return c.json(interactionMessage("Your Discord account is not linked to a Flow workspace member."));
  }

  if (actor.status === "integrity_error") {
    return c.json(interactionMessage("Flow could not resolve your workspace permissions."));
  }

  const canAccessProject = await canDiscordActorAccessProject(db, taskContext.projectId, taskContext.projectVisibility, actor.userId, actor.permissions);

  if (!canAccessProject) {
    /*
     * Avoid leaking private Project
     * existence/details to a workspace
     * member who does not have access.
     */
    return c.json(interactionMessage("This Flow Task is not available to your account."));
  }

  const editsTask = commandName === "setstatus" || commandName === "setpriority" || commandName === "setstartdate" || commandName === "setduedate";

  const assignsTask = commandName === "setlead" || commandName === "setassign";

  if (editsTask && !actor.permissions.includes("tasks.edit")) {
    return c.json(interactionMessage("You do not have permission to edit this Task in Flow."));
  }

  if (assignsTask && !actor.permissions.includes("tasks.assign")) {
    return c.json(interactionMessage("You do not have permission to assign this Task in Flow."));
  }

  if (commandName === "setstatus") {
    const rawStatus = findStringOption(interaction, "status");

    const parsedStatus = taskStatusSchema.safeParse(rawStatus);

    if (!parsedStatus.success) {
      return c.json(interactionMessage("Invalid Task status."));
    }

    /*
     * Fixed status vocabulary is shared,
     * but each Project may disable a
     * workflow status.
     */
    const [workflowStatus] = await db
      .select({
        enabled: projectTaskStatuses.enabled,
      })
      .from(projectTaskStatuses)
      .where(and(eq(projectTaskStatuses.projectId, taskContext.projectId), eq(projectTaskStatuses.statusKey, parsedStatus.data)))
      .limit(1);

    if (!workflowStatus?.enabled) {
      return c.json(interactionMessage("That Task status is disabled for this Project."));
    }

    const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
      kind: "status",

      value: parsedStatus.data,
    });

    c.executionCtx.waitUntil(
      dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId)
        .then((result) => {
          if (result.status === "error") {
            console.error("Discord command Task sync dispatch failed", {
              commandName,

              taskId: taskContext.taskId,

              outboxEventId,

              result,
            });
          }
        })
        .catch((error) => {
          console.error("Discord command Task sync dispatch crashed", {
            commandName,

            taskId: taskContext.taskId,

            outboxEventId,

            error,
          });
        }),
    );

    return c.json(interactionMessage(`Task status updated to ${parsedStatus.data}.`));
  }

  if (commandName === "setpriority") {
    const rawPriority = findStringOption(interaction, "priority");

    let priority: TaskPriority | null;

    if (rawPriority === "none") {
      priority = null;
    } else {
      const parsedPriority = taskPrioritySchema.safeParse(rawPriority);

      if (!parsedPriority.success) {
        return c.json(interactionMessage("Invalid Task priority."));
      }

      priority = parsedPriority.data;
    }

    const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
      kind: "priority",

      value: priority,
    });

    c.executionCtx.waitUntil(
      dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId)
        .then((result) => {
          if (result.status === "error") {
            console.error("Discord command Task sync dispatch failed", {
              commandName,

              taskId: taskContext.taskId,

              outboxEventId,

              result,
            });
          }
        })
        .catch((error) => {
          console.error("Discord command Task sync dispatch crashed", {
            commandName,

            taskId: taskContext.taskId,

            outboxEventId,

            error,
          });
        }),
    );

    return c.json(interactionMessage(priority === null ? "Task priority cleared." : `Task priority updated to ${priority}.`));
  }

  if (commandName === "setlead") {
    const action = findStringOption(interaction, "action");

    if (action !== "set" && action !== "clear") {
      return c.json(interactionMessage("Invalid lead action."));
    }

    if (action === "clear") {
      const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
        kind: "lead",
        value: null,
      });

      c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId));

      return c.json(interactionMessage("Task lead cleared."));
    }

    const targetDiscordUserId = findStringOption(interaction, "user");

    if (!targetDiscordUserId) {
      return c.json(interactionMessage("Select a Discord user for the Task lead."));
    }

    const target = await resolveDiscordProjectMember(db, taskContext.workspaceId, taskContext.projectId, targetDiscordUserId);

    if (!target) {
      return c.json(interactionMessage("The selected Discord user is not an available Flow Project member."));
    }

    const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
      kind: "lead",
      value: target.userId,
    });

    c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId));

    return c.json(interactionMessage(`Task lead updated to ${target.displayName}.`));
  }
  if (commandName === "setassign") {
    const action = findStringOption(interaction, "action");

    const targetDiscordUserId = findStringOption(interaction, "user");

    if ((action !== "add" && action !== "remove") || !targetDiscordUserId) {
      return c.json(interactionMessage("Invalid Task assignment command."));
    }

    const target = await resolveDiscordProjectMember(db, taskContext.workspaceId, taskContext.projectId, targetDiscordUserId);

    if (!target) {
      return c.json(interactionMessage("The selected Discord user is not an available Flow Project member."));
    }

    const result = await persistDiscordAssigneeMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, target.userId, action);

    if (!result.changed || !result.eventId) {
      return c.json(interactionMessage(action === "add" ? `${target.displayName} is already assigned to this Task.` : `${target.displayName} is not assigned to this Task.`));
    }

    c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, result.eventId));

    return c.json(interactionMessage(action === "add" ? `${target.displayName} assigned to this Task.` : `${target.displayName} removed from this Task.`));
  }
  if (commandName === "setstartdate") {
    const rawDate = findStringOption(interaction, "date");

    const parsedDate = taskDateSchema.safeParse(rawDate);

    if (!parsedDate.success) {
      return c.json(interactionMessage("Start date must use YYYY-MM-DD."));
    }

    const [currentTask] = await db
      .select({
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskContext.taskId), isNull(tasks.archivedAt)))
      .limit(1);

    if (!currentTask) {
      return c.json(interactionMessage("This Flow Task is no longer available."));
    }

    if (currentTask.dueDate && currentTask.dueDate < parsedDate.data) {
      return c.json(interactionMessage("Start date cannot be after the current due date."));
    }

    const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
      kind: "start_date",

      value: parsedDate.data,
    });

    c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId));

    return c.json(interactionMessage(`Task start date updated to ${parsedDate.data}.`));
  }
  const rawDate = findStringOption(interaction, "date");

  let dueDate: string | null;

  if (rawDate === "clear") {
    dueDate = null;
  } else {
    const parsedDate = taskDateSchema.safeParse(rawDate);

    if (!parsedDate.success) {
      return c.json(interactionMessage("Due date must use YYYY-MM-DD or clear."));
    }

    dueDate = parsedDate.data;
  }

  const [currentTask] = await db
    .select({
      startDate: tasks.startDate,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskContext.taskId), isNull(tasks.archivedAt)))
    .limit(1);

  if (!currentTask) {
    return c.json(interactionMessage("This Flow Task is no longer available."));
  }

  if (dueDate && dueDate < currentTask.startDate) {
    return c.json(interactionMessage("Due date cannot be before the current start date."));
  }

  const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.projectId, taskContext.taskId, {
    kind: "due_date",

    value: dueDate,
  });

  c.executionCtx.waitUntil(dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, outboxEventId));

  return c.json(interactionMessage(dueDate ? `Task due date updated to ${dueDate}.` : "Task due date cleared."));
});
