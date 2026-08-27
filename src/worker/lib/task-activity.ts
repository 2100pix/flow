import { and, desc, eq, lt, or } from "drizzle-orm";

import { resolvePersonName } from "./person-name";
import { createDb } from "../db";
import { taskActivity, users } from "../db/schema";
import { taskActivityCursorSchema, taskActivityMetadataSchema, TASK_ACTIVITY_PAGE_SIZE, type TaskActivityDto, type TaskActivityEvent, type TaskActivityMetadata } from "../../shared/contracts/task-activity";

type Db = ReturnType<typeof createDb>;

export type TaskActivityEntry = {
  taskId: string;

  projectId: string;

  actorUserId: string;

  eventType: TaskActivityEvent;

  metadata?: TaskActivityMetadata | null;
};

/*
 * Membangun statement insert activity —
 * TIDAK mengeksekusinya. Pemanggil yang
 * menyisipkannya ke db.batch bersama
 * statement mutasi utama sehingga mutasi
 * dan activity menjadi satu transaksi
 * atomik (D1 batch = all-or-nothing).
 */
export function buildTaskActivityInsert(db: Db, entries: TaskActivityEntry[], createdAt: Date) {
  return db.insert(taskActivity).values(
    entries.map((entry) => ({
      id: `act_${crypto.randomUUID().replaceAll("-", "")}`,
      taskId: entry.taskId,
      projectId: entry.projectId,
      actorUserId: entry.actorUserId,

      eventType: entry.eventType,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt,
    })),
  );
}

/*
 * Format cursor: "<createdAt>|<id>".
 * Karakter "|" tidak pernah muncul di id
 * (act_<hex>), sehingga cukup di-split tanpa
 * encoding tambahan.
 */
function parseActivityCursor(cursor: string) {
  const separatorIndex = cursor.indexOf("|");

  if (separatorIndex <= 0) {
    return null;
  }

  const createdAt = Number(cursor.slice(0, separatorIndex));

  const parsed = taskActivityCursorSchema.safeParse({
    createdAt,

    id: cursor.slice(separatorIndex + 1),
  });

  return parsed.success ? parsed.data : null;
}

/*
 * Keyset pagination pada (created_at, id).
 * Tiap halaman memakai index
 * (task_id, created_at, id) dan tidak pernah
 * memindai seluruh history — aman untuk D1.
 */
export async function listTaskActivity(
  db: Db,
  taskId: string,
  cursor: string | null,
  limit: number = TASK_ACTIVITY_PAGE_SIZE,
): Promise<{
  data: TaskActivityDto[];

  nextCursor: string | null;
}> {
  const cursorData = cursor ? parseActivityCursor(cursor) : null;

  const keysetCondition = cursorData
    ? or(
        lt(taskActivity.createdAt, new Date(cursorData.createdAt)),

        and(eq(taskActivity.createdAt, new Date(cursorData.createdAt)), lt(taskActivity.id, cursorData.id)),
      )
    : undefined;

  const rows = await db
    .select({
      id: taskActivity.id,
      eventType: taskActivity.eventType,
      metadata: taskActivity.metadata,
      createdAt: taskActivity.createdAt,

      actor: {
        id: users.id,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(taskActivity)
    .innerJoin(users, eq(users.id, taskActivity.actorUserId))
    .where(keysetCondition ? and(eq(taskActivity.taskId, taskId), keysetCondition) : eq(taskActivity.taskId, taskId))
    .orderBy(desc(taskActivity.createdAt), desc(taskActivity.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const data: TaskActivityDto[] = pageRows.map((row) => {
    // SAFETY: kolom event_type dikunci oleh CHECK constraint di migrasi
    // yang enumerasi nilai yang sama persis dengan TaskActivityEvent.
    const eventType = row.eventType as TaskActivityEvent;

    let metadata: TaskActivityMetadata | null = null;

    if (row.metadata) {
      try {
        const parsed = taskActivityMetadataSchema.safeParse(JSON.parse(row.metadata));

        metadata = parsed.success ? parsed.data : null;
      } catch {
        metadata = null;
      }
    }

    return {
      id: row.id,
      eventType,

      actor: {
        id: row.actor.id,
        displayName: resolvePersonName(row.actor),
        firstName: row.actor.firstName,
        lastName: row.actor.lastName,
        avatarUrl: row.actor.avatarUrl,
      },

      metadata,
      createdAt: row.createdAt.toISOString(),
    };
  });

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow ? `${lastRow.createdAt.getTime()}|${lastRow.id}` : null;

  return {
    data,

    nextCursor,
  };
}
