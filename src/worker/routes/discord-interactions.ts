import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { taskPrioritySchema, taskStatusSchema, type TaskPriority, type TaskStatus } from "../../shared/contracts/tasks";
import { parsePermissionKeys, type PermissionKey } from "../../shared/permissions";
import { builtInRoleDefinitions } from "../../shared/roles";

import { createDb } from "../db";
import { discordOutboxEvents, projectTaskStatuses, projects, taskDiscordThreads, tasks, users, workspaceDiscordIntegrations, workspaceMembers, workspaceRolePermissions, workspaceRoles } from "../db/schema";
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

      value: TaskPriority;
    };

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

async function persistDiscordTaskMutation(db: ReturnType<typeof createDb>, workspaceId: string, taskId: string, mutation: DiscordTaskMutation) {
  const now = new Date();

  const eventId = createId("obx");

  const taskUpdate =
    mutation.kind === "status"
      ? db
          .update(tasks)
          .set({
            status: mutation.value,

            updatedAt: now,
          })
          .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
      : db
          .update(tasks)
          .set({
            priority: mutation.value,

            updatedAt: now,
          })
          .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)));

  /*
   * Same fresh-event-ID coalescing rule
   * used by Flow-originated mutations.
   *
   * Old queued payloads reference an old
   * outbox ID and cannot overwrite this
   * latest intent.
   */
  await db.batch([
    taskUpdate,

    db.delete(discordOutboxEvents).where(and(eq(discordOutboxEvents.aggregateId, taskId), eq(discordOutboxEvents.eventType, "task_thread.sync"))),

    db.insert(discordOutboxEvents).values({
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
  ]);

  return eventId;
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

  if (commandName !== "setstatus" && commandName !== "setpriority") {
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

  if (!actor.permissions.includes("tasks.edit")) {
    return c.json(interactionMessage("You do not have permission to edit this Task in Flow."));
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

    const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.taskId, {
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

  const rawPriority = findStringOption(interaction, "priority");

  const parsedPriority = taskPrioritySchema.safeParse(rawPriority);

  if (!parsedPriority.success) {
    return c.json(interactionMessage("Invalid Task priority."));
  }

  const outboxEventId = await persistDiscordTaskMutation(db, taskContext.workspaceId, taskContext.taskId, {
    kind: "priority",

    value: parsedPriority.data,
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

  return c.json(interactionMessage(`Task priority updated to ${parsedPriority.data}.`));
});
