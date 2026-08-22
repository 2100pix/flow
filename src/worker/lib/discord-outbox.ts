import { and, asc, eq } from "drizzle-orm";

import { createDb } from "../db";

import { discordOutboxEvents } from "../db/schema";

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

function resolveDispatchError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Discord outbox dispatch error";

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
    });
  } catch (error) {
    const message = resolveDispatchError(error);

    await db
      .update(discordOutboxEvents)
      .set({
        lastDispatchError: message,

        updatedAt: new Date(),
      })
      .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending"), eq(discordOutboxEvents.dispatchAttemptCount, claimed.attemptCount)));

    return {
      status: "error",

      eventId,

      attemptCount: claimed.attemptCount,

      message,
    };
  }

  const dispatchedAt = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",

      lastDispatchError: null,

      dispatchedAt,

      updatedAt: dispatchedAt,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending"), eq(discordOutboxEvents.dispatchAttemptCount, claimed.attemptCount)));

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
    .where(and(eq(discordOutboxEvents.workspaceId, workspaceId), eq(discordOutboxEvents.status, "pending")))
    .orderBy(asc(discordOutboxEvents.createdAt))
    .limit(limit);

  const results: DispatchDiscordOutboxResult[] = [];

  for (const event of events) {
    results.push(await dispatchDiscordOutboxEvent(db, queue, event.id));
  }

  return results;
}
export async function markDiscordOutboxEventDispatched(db: Db, eventId: string) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",

      lastDispatchError: null,

      dispatchedAt: now,

      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending")));
}
export async function returnDiscordOutboxEventToPending(db: Db, eventId: string, reason: string) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "pending",

      lastDispatchError: reason.slice(0, MAX_DISPATCH_ERROR_LENGTH),

      dispatchedAt: null,

      updatedAt: now,
    })
    .where(eq(discordOutboxEvents.id, eventId));
}

export async function reconcileDiscordOutboxEventDispatched(db: Db, eventId: string) {
  const now = new Date();

  await db
    .update(discordOutboxEvents)
    .set({
      status: "dispatched",

      lastDispatchError: null,

      dispatchedAt: now,

      updatedAt: now,
    })
    .where(and(eq(discordOutboxEvents.id, eventId), eq(discordOutboxEvents.status, "pending")));
}
