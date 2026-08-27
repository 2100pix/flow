import * as z from "zod";

export const taskActivityEventSchema = z.enum(["TASK_CREATED", "STATUS_CHANGED", "PRIORITY_CHANGED", "ASSIGNEE_ADDED", "ASSIGNEE_REMOVED", "LEAD_CHANGED", "START_DATE_CHANGED", "DUE_DATE_CHANGED", "DESCRIPTION_CHANGED", "RESOURCE_ADDED"]);

export type TaskActivityEvent = z.infer<typeof taskActivityEventSchema>;

export type TaskActivityActorDto = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

export type TaskActivityDto = {
  id: string;
  eventType: TaskActivityEvent;
  actor: TaskActivityActorDto;
  metadata: TaskActivityMetadata | null;
  createdAt: string;
};

export type TaskActivityPage = {
  data: TaskActivityDto[];
  nextCursor: string | null;
};

export const taskActivityCursorSchema = z.object({
  createdAt: z.number().int().nonnegative(),
  id: z.string().min(1),
});

export type TaskActivityCursor = z.infer<typeof taskActivityCursorSchema>;

/*
 * Metadata per jenis eventunion setiap varian nilai konkret:
 * - change: status/priority/lead/tanggal ({before, after})
 * - assignee: {userId, userName} snapshot saat kejadian
 * - description: hanya panjang teks lama/baru (tanpa isi)
 * - resource: {title, resourceType}
 */
export const taskActivityChangeMetadataSchema = z.object({
  before: z.string().nullable(),
  after: z.string().nullable(),
});

export const taskActivityAssigneeMetadataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
});

export const taskActivityDescriptionMetadataSchema = z.object({
  oldLength: z.number().int().nonnegative(),
  newLength: z.number().int().nonnegative(),
});

export const taskActivityResourceMetadataSchema = z.object({
  title: z.string().nullable(),
  resourceType: z.string(),
});

export const taskActivityMetadataSchema = z.union([taskActivityChangeMetadataSchema, taskActivityAssigneeMetadataSchema, taskActivityDescriptionMetadataSchema, taskActivityResourceMetadataSchema]);

export type TaskActivityMetadata = z.infer<typeof taskActivityMetadataSchema>;
export type TaskActivityChangeMetadata = z.infer<typeof taskActivityChangeMetadataSchema>;
export type TaskActivityAssigneeMetadata = z.infer<typeof taskActivityAssigneeMetadataSchema>;
export type TaskActivityDescriptionMetadata = z.infer<typeof taskActivityDescriptionMetadataSchema>;
export type TaskActivityResourceMetadata = z.infer<typeof taskActivityResourceMetadataSchema>;

export const TASK_ACTIVITY_PAGE_SIZE = 50;
