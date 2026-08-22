import { eq } from "drizzle-orm";

import { createDb } from "../db";

import { discordOutboxEvents } from "../db/schema";

import type { AppBindings } from "../types/app-env";

import type { DiscordOutboxQueueMessage } from "../types/discord-queue";

import { provisionProjectDiscordForum } from "./project-discord-forum";
import { markDiscordOutboxEventDispatched, reconcileDiscordOutboxEventDispatched, returnDiscordOutboxEventToPending } from "./discord-outbox";

type Db = ReturnType<typeof createDb>;

type ProcessDiscordQueueResult =
  | {
      status: "processed";

      eventId: string;

      projectId: string;

      forumChannelId: string;
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
  if (!body || typeof body.outboxEventId !== "string" || !body.outboxEventId || typeof body.dispatchAttemptCount !== "number" || !Number.isInteger(body.dispatchAttemptCount) || body.dispatchAttemptCount < 1) {
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
  if (event.aggregateType !== "project_forum" || event.eventType !== "project_forum.provision") {
    await markDiscordOutboxEventDispatched(db, eventId, body.dispatchAttemptCount);
    return {
      status: "ignored",

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

      projectId: result.projectId,

      forumChannelId: result.forumChannelId,
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
