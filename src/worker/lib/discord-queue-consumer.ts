import { eq } from "drizzle-orm";

import { createDb } from "../db";

import { discordOutboxEvents } from "../db/schema";
import { provisionTaskDiscordThread, syncTaskDiscordThread } from "./task-discord-thread";

import { deliverDiscordTaskReminder } from "./discord-reminders";

import type { AppBindings } from "../types/app-env";

import type { DiscordOutboxQueueMessage } from "../types/discord-queue";

import { provisionProjectDiscordForum } from "./project-discord-forum";
import { markDiscordOutboxEventDispatched, reconcileDiscordOutboxEventDispatched, returnDiscordOutboxEventToPending } from "./discord-outbox";

type Db = ReturnType<typeof createDb>;

type ProcessDiscordQueueResult =
  | {
      status: "processed";

      eventId: string;

      aggregateType: "project_forum" | "task_thread" | "task_reminder";
      aggregateId: string;
    }
  | {
      status: "deferred";

      eventId: string;

      reason: string;
    }
  | {
      status: "retry";

      eventId: string;

      reason: string;
    }
  | {
      status: "ignored";

      eventId: string | null;

      reason: string;
    };

async function processDiscordOutboxQueueMessage(db: Db, botToken: string, body: DiscordOutboxQueueMessage): Promise<ProcessDiscordQueueResult> {
  if (!body || !body.outboxEventId || !Number.isInteger(body.dispatchAttemptCount) || body.dispatchAttemptCount < 1) {
    return {
      status: "ignored",

      eventId: null,

      reason: "invalid_message",
    };
  }

  const eventId = body.outboxEventId;

  const [event] = await db
    .select({
      id: discordOutboxEvents.id,

      aggregateType: discordOutboxEvents.aggregateType,

      aggregateId: discordOutboxEvents.aggregateId,

      eventType: discordOutboxEvents.eventType,
      dispatchAttemptCount: discordOutboxEvents.dispatchAttemptCount,
    })
    .from(discordOutboxEvents)
    .where(eq(discordOutboxEvents.id, eventId))
    .limit(1);

  if (!event) {
    return {
      status: "ignored",

      eventId,

      reason: "event_missing",
    };
  }
  if (event.dispatchAttemptCount !== body.dispatchAttemptCount) {
    return {
      status: "ignored",

      eventId,

      reason: "stale_dispatch_attempt",
    };
  }
  if (event.aggregateType === "task_reminder" && event.eventType === "task_reminder.send") {
    await markDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

    const result = await deliverDiscordTaskReminder(db, botToken, event.aggregateId);

    if (result.status === "sent") {
      await reconcileDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

      return {
        status: "processed",

        eventId,

        aggregateType: "task_reminder",

        aggregateId: result.reminderId,
      };
    }

    if (result.status === "cancelled") {
      await reconcileDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

      return {
        status: "processed",

        eventId,

        aggregateType: "task_reminder",

        aggregateId: result.reminderId,
      };
    }

    await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, `Task reminder delivery failed: ${result.message}`);

    return {
      status: "deferred",

      eventId,

      reason: result.message,
    };
  }
  if (event.aggregateType === "task_thread" && event.eventType === "task_thread.sync") {
    /*
     * Receiving this Queue message proves
     * queue.send() succeeded.
     *
     * Persist that delivery fact first.
     * Any Discord failure below may then
     * return this exact dispatch attempt
     * back to durable pending state.
     */
    await markDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

    /*
     * syncTaskDiscordThread never trusts
     * mutation payloads carried by Queue.
     *
     * It re-reads the latest authoritative
     * Task, assignees, resources, mapping,
     * and integration state from D1.
     */
    const result = await syncTaskDiscordThread(db, botToken, event.aggregateId);

    if (result.status === "synced") {
      await reconcileDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

      return {
        status: "processed",

        eventId,

        aggregateType: "task_thread",

        aggregateId: result.taskId,
      };
    }

    if (result.status === "error") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, `Task message sync failed: ${result.message}`);

      return {
        status: "deferred",

        eventId,

        reason: result.message,
      };
    }

    if (result.reason === "integration_disabled") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is disabled");

      return {
        status: "deferred",

        eventId,

        reason: "integration_disabled",
      };
    }

    if (result.reason === "integration_not_connected") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is not connected");

      return {
        status: "deferred",

        eventId,

        reason: "integration_not_connected",
      };
    }

    if (result.reason === "project_forum_not_ready") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because the Project Discord Forum is not ready");

      return {
        status: "deferred",

        eventId,

        reason: "project_forum_not_ready",
      };
    }

    if (result.reason === "mapping_not_ready") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because the Task Discord thread is not ready");

      return {
        status: "deferred",

        eventId,

        reason: "task_thread_not_ready",
      };
    }

    /*
     * mapping_missing means the Task no
     * longer owns a Discord sync target.
     *
     * The Queue delivery itself was valid,
     * so leave this old event dispatched
     * and ACK it instead of retrying
     * indefinitely.
     */
    return {
      status: "ignored",

      eventId,

      reason: "mapping_missing",
    };
  }

  if (event.aggregateType === "task_thread" && event.eventType === "task_thread.provision") {
    await markDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

    const result = await provisionTaskDiscordThread(db, botToken, event.aggregateId);

    if (result.status === "ready") {
      await reconcileDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);

      return {
        status: "processed",

        eventId,

        aggregateType: "task_thread",

        aggregateId: result.taskId,
      };
    }

    if (result.status === "busy") {
      return {
        status: "retry",

        eventId,

        reason: "task_thread_provisioning_busy",
      };
    }

    if (result.status === "error") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, `Task thread provisioning failed: ${result.message}`);

      return {
        status: "deferred",

        eventId,

        reason: result.message,
      };
    }

    if (result.reason === "integration_disabled") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is disabled");

      return {
        status: "deferred",

        eventId,

        reason: "integration_disabled",
      };
    }

    if (result.reason === "integration_not_connected") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is not connected");

      return {
        status: "deferred",

        eventId,

        reason: "integration_not_connected",
      };
    }

    if (result.reason === "project_forum_not_ready") {
      await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because the Project Discord Forum is not ready");

      return {
        status: "deferred",

        eventId,

        reason: "project_forum_not_ready",
      };
    }

    /*
     * mapping_missing is stale/non-provisionable
     * state. The Queue delivery itself was valid,
     * so keep the outbox dispatched and ACK it.
     */
    return {
      status: "ignored",

      eventId,

      reason: "mapping_missing",
    };
  }

  if (event.aggregateType !== "project_forum" || event.eventType !== "project_forum.provision") {
    await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Unsupported Discord outbox event");

    return {
      status: "deferred",

      eventId,

      reason: "unsupported_event",
    };
  }

  /*
   * Receiving the Queue message proves that
   * queue.send() succeeded at least once.
   *
   * Close the producer crash-gap here if the
   * producer did not manage to persist its
   * dispatched state before this consumer ran.
   */
  await markDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);
  const result = await provisionProjectDiscordForum(db, botToken, event.aggregateId);

  if (result.status === "ready") {
    await reconcileDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);
    return {
      status: "processed",

      eventId,

      aggregateType: "project_forum",

      aggregateId: result.projectId,
    };
  }

  if (result.status === "busy") {
    return {
      status: "retry",

      eventId,

      reason: "provisioning_busy",
    };
  }

  if (result.status === "error") {
    await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, `Forum provisioning failed: ${result.message}`);
    return {
      status: "deferred",

      eventId,

      reason: result.message,
    };
  }

  if (result.reason === "integration_disabled") {
    await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is disabled");
    return {
      status: "deferred",

      eventId,

      reason: "integration_disabled",
    };
  }

  if (result.reason === "integration_not_connected") {
    await returnDiscordOutboxEventToPending(db, eventId, body.dispatchAttemptCount, "Deferred because Discord integration is not connected");
    return {
      status: "deferred",

      eventId,

      reason: "integration_not_connected",
    };
  }

  /*
   * mapping_missing means the aggregate is
   * no longer provisionable.
   *
   * With the Phase 2D.2 atomic batch this
   * should normally mean stale/deleted data,
   * not a transient delivery problem.
   */
  return {
    status: "ignored",

    eventId,

    reason: "mapping_missing",
  };
}

export async function consumeDiscordOutboxBatch(batch: MessageBatch<DiscordOutboxQueueMessage>, env: AppBindings) {
  const db = createDb(env.flow_db);

  for (const message of batch.messages) {
    try {
      const result = await processDiscordOutboxQueueMessage(db, env.DISCORD_BOT_TOKEN, message.body);

      if (result.status === "retry") {
        message.retry({
          delaySeconds: 15,
        });

        continue;
      }

      /*
       * processed:
       *   provisioning completed.
       *
       * deferred:
       *   durable intent has already been
       *   returned to D1 pending.
       *
       * ignored:
       *   stale/invalid message has no
       *   useful Queue retry path.
       */
      message.ack();

      if (result.status === "ignored") {
        console.warn("Ignored Discord queue message", result);
      }
    } catch (error) {
      /*
       * Unexpected infrastructure failure:
       * do not ACK. Ask Queue to redeliver.
       */
      console.error("Discord queue consumer failed", {
        messageId: message.id,

        outboxEventId: message.body?.outboxEventId,

        error,
      });

      message.retry({
        delaySeconds: 30,
      });
    }
  }
}
