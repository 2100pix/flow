import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { createDb } from "../db";

import { discordOutboxEvents, workspaceDiscordIntegrations } from "../db/schema";
import type { DiscordOutboxQueueMessage } from "../types/discord-queue";

type Db = ReturnType<typeof createDb>;

const DISPATCH_LEASE_MS = 60_000;
const MAX_DISPATCH_ERROR_LENGTH = 1_000;

export type DispatchDiscordOutboxResult =
  | {
      status: "missing";
      eventId: string;
    }
  | {
      status: "already_dispatched";
      eventId: string;
    }
  | {
      status: "busy";
      eventId: string;
    }
  | {
      status: "dispatched";
      eventId: string;
      attemptCount: number;
    }
  | {
      status: "error";
      eventId: string;
      attemptCount: number;
      message: string;
    };

function resolveDispatchError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "Unknown Discord outbox dispatch error";
  return message.slice(0, MAX_DISPATCH_ERROR_LENGTH);
}

export async function dispatchDiscordOutboxEvent(db: Db, queue: Queue<DiscordOutboxQueueMessage>, eventId: string): Promise<DispatchDiscordOutboxResult> {
  const [event] = await db
    .select({
      id: discordOutboxEvents.id,
      status: discordOutboxEvents.status,
      dispatchAttemptCount: discordOutboxEvents.dispatchAttemptCount,
      lastDispatchError: discordOutboxEvents.lastDispatchError,
      updatedAt: discordOutboxEvents.updatedAt,
    })
    .from(discordOutboxEvents)
    .where(eq(discordOutboxEvents.id, eventId))
    .limit(1);

  if (!event) {
    return {
      status: "missing",
      eventId,
    };
  }

  if (event.status === "dispatched") {
    return {
      status: "already_dispatched",
      eventId,
    };
  }

  const now = new Date();

  /*
   * updatedAt acts as a short dispatch
   * lease while the event is pending.
   *
   * A failed dispatch has lastDispatchError,
   * so it can be retried immediately.
   *
   * A crashed dispatcher without an error
   * waits for the lease to expire.
   */
  if (event.dispatchAttemptCount > 0 && !event.lastDispatchError && now.getTime() - event.updatedAt.getTime() < DISPATCH_LEASE_MS) {
    return {
      status: "busy",
      eventId,
    };
  }

  const nextAttemptCount = event.dispatchAttemptCount + 1;

  const [claimed] = await db
    .update(discordOutboxEvents)
    .set({
      dispatchAttemptCount: nextAttemptCount,
      lastDispatchError: null,
      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending"), eq(discordOutboxEvents.dispatchAttemptCount, event.dispatchAttemptCount)))
    .returning({
      attemptCount: discordOutboxEvents.dispatchAttemptCount,
    });

  if (!claimed) {
    const [latest] = await db
      .select({
        status: discordOutboxEvents.status,
      })
      .from(discordOutboxEvents)
      .where(eq(discordOutboxEvents.id, eventId))
      .limit(1);

    if (latest?.status === "dispatched") {
      return {
        status: "already_dispatched",
        eventId,
      };
    }

    return {
      status: "busy",
      eventId,
    };
  }

  try {
    await queue.send({
      outboxEventId: eventId,
      dispatchAttemptCount: claimed.attemptCount,
    });
  } catch (cause) {
    const message = resolveDispatchError(cause);

    await db
      .update(discordOutboxEvents)
      .set({
        lastDispatchError: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(discordOutboxEvents.id, eventId),
          eq(discordOutboxEvents.status, "pending"),
          eq(discordOutboxEvents.dispatchAttemptCount, claimed.attemptCount),

          /*
           * Consumer may already have processed
           * this Queue message and intentionally
           * returned the event to pending with an
           * error/defer reason.
           *
           * Never overwrite that durable retry
           * state with "dispatched".
           */
          isNull(discordOutboxEvents.lastDispatchError),
        ),
      );
    return {
      status: "error",
      eventId,
      attemptCount: claimed.attemptCount,
      message,
    };
  }

  const dispatchedAt = new Date();

  const [finalized] = await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",
      lastDispatchError: null,
      dispatchedAt,
      updatedAt: dispatchedAt,
    })
    .where(
      and(
        eq(discordOutboxEvents.id, eventId),
        eq(discordOutboxEvents.status, "pending"),
        eq(discordOutboxEvents.dispatchAttemptCount, claimed.attemptCount),

        /*
         * The Queue consumer may already have
         * received this dispatch and returned
         * the durable event to pending with a
         * defer/error reason.
         *
         * Never let the producer erase that
         * consumer-owned retry state.
         */
        isNull(discordOutboxEvents.lastDispatchError),
      ),
    )
    .returning({
      status: discordOutboxEvents.status,
      dispatchAttemptCount: discordOutboxEvents.dispatchAttemptCount,
      lastDispatchError: discordOutboxEvents.lastDispatchError,
    });

  if (!finalized) {
    const [latest] = await db
      .select({
        status: discordOutboxEvents.status,
        dispatchAttemptCount: discordOutboxEvents.dispatchAttemptCount,
        lastDispatchError: discordOutboxEvents.lastDispatchError,
      })
      .from(discordOutboxEvents)
      .where(eq(discordOutboxEvents.id, eventId))
      .limit(1);

    if (latest?.dispatchAttemptCount !== claimed.attemptCount) {
      return {
        status: "busy",
        eventId,
      };
    }

    if (latest.status === "pending" && latest.lastDispatchError) {
      return {
        status: "error",
        eventId,
        attemptCount: claimed.attemptCount,
        message: latest.lastDispatchError,
      };
    }
  }

  return {
    status: "dispatched",
    eventId,
    attemptCount: claimed.attemptCount,
  };
}

export async function dispatchPendingDiscordOutboxEvents(db: Db, queue: Queue<DiscordOutboxQueueMessage>, workspaceId: string, limit = 25) {
  const events = await db
    .select({
      id: discordOutboxEvents.id,
    })
    .from(discordOutboxEvents)
    .where(
      and(
        eq(discordOutboxEvents.workspaceId, workspaceId),

        eq(discordOutboxEvents.status, "pending"),

        /*
         * Workspace-scoped manual dispatch may
         * execute all Discord event types whose
         * consumers are implemented.
         *
         * Global scheduled automation remains
         * separately gated until Phase 3C.3.
         */
        inArray(discordOutboxEvents.eventType, ["project_forum.provision", "task_thread.provision", "task_thread.sync", "task_reminder.send"]),
      ),
    )
    .orderBy(asc(discordOutboxEvents.createdAt))
    .limit(limit);

  const results: DispatchDiscordOutboxResult[] = [];

  for (const event of events) {
    results.push(await dispatchDiscordOutboxEvent(db, queue, event.id));
  }

  return results;
}

export async function dispatchAllPendingDiscordOutboxEvents(db: Db, queue: Queue<DiscordOutboxQueueMessage>, limit = 100) {
  /*
   * Automatic recovery only processes
   * workspaces whose Discord integration
   * is currently active.
   *
   * This prevents a disabled integration
   * from generating Queue churn every time
   * the scheduled sweeper runs.
   */
  const events = await db
    .select({
      id: discordOutboxEvents.id,
    })
    .from(discordOutboxEvents)
    .innerJoin(workspaceDiscordIntegrations, eq(workspaceDiscordIntegrations.workspaceId, discordOutboxEvents.workspaceId))
    .where(
      and(
        eq(discordOutboxEvents.status, "pending"),

        inArray(discordOutboxEvents.eventType, ["project_forum.provision", "task_thread.provision", "task_thread.sync", "task_reminder.send"]),
        eq(workspaceDiscordIntegrations.enabled, true),

        isNotNull(workspaceDiscordIntegrations.guildId),
      ),
    )
    .orderBy(asc(discordOutboxEvents.createdAt))
    .limit(limit);

  const results: DispatchDiscordOutboxResult[] = [];

  for (const event of events) {
    results.push(await dispatchDiscordOutboxEvent(db, queue, event.id));
  }

  return results;
}

export async function markDiscordOutboxEventDispatched(db: Db, eventId: string, dispatchAttemptCount: number) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",
      lastDispatchError: null,
      dispatchedAt: now,
      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending"), eq(discordOutboxEvents.dispatchAttemptCount, dispatchAttemptCount)));
}

export async function returnDiscordOutboxEventToPending(db: Db, eventId: string, dispatchAttemptCount: number, reason: string) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "pending",
      lastDispatchError: reason.slice(0, MAX_DISPATCH_ERROR_LENGTH),
      dispatchedAt: null,
      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.dispatchAttemptCount, dispatchAttemptCount)));
}

export async function reconcileDiscordOutboxEventDispatched(db: Db, eventId: string, dispatchAttemptCount: number) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",
      lastDispatchError: null,
      dispatchedAt: now,
      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.dispatchAttemptCount, dispatchAttemptCount)));
}
