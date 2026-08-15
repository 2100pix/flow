import * as z from "zod";

import { taskStatusSchema, type TaskStatus } from "./tasks";

export type TaskWorkflowStatusDto = {
  statusKey: TaskStatus;
  label: string;
  position: number;
  enabled: boolean;
};

export type TaskWorkflowDto = {
  projectId: string;
  statuses: TaskWorkflowStatusDto[];
};

export type TaskWorkflowResponse = {
  data: TaskWorkflowDto;
};

export const defaultTaskWorkflowStatuses = [
  {
    statusKey: "backlog",
    label: "Backlog",
    position: 0,
    enabled: true,
  },
  {
    statusKey: "todo",
    label: "To do",
    position: 1,
    enabled: true,
  },
  {
    statusKey: "in_progress",
    label: "In progress",
    position: 2,
    enabled: true,
  },
  {
    statusKey: "review",
    label: "Review",
    position: 3,
    enabled: true,
  },
  {
    statusKey: "done",
    label: "Done",
    position: 4,
    enabled: true,
  },
] satisfies readonly TaskWorkflowStatusDto[];

export const updateTaskWorkflowStatusSchema = z.object({
  statusKey: taskStatusSchema,

  label: z.string().trim().min(1).max(40),

  enabled: z.boolean(),
});

export const updateTaskWorkflowSchema = z
  .object({
    statuses: z.array(updateTaskWorkflowStatusSchema).length(5),
  })
  .superRefine((value, ctx) => {
    const statusKeys = value.statuses.map((status) => status.statusKey);

    if (new Set(statusKeys).size !== statusKeys.length) {
      ctx.addIssue({
        code: "custom",
        path: ["statuses"],
        message: "Status keys must be unique",
      });
    }

    for (const requiredStatus of ["backlog", "done"] as const) {
      const index = value.statuses.findIndex((status) => status.statusKey === requiredStatus);

      if (index === -1) {
        ctx.addIssue({
          code: "custom",
          path: ["statuses"],
          message: `Missing required status: ${requiredStatus}`,
        });

        continue;
      }

      if (!value.statuses[index].enabled) {
        ctx.addIssue({
          code: "custom",
          path: ["statuses", index, "enabled"],
          message: `${requiredStatus} must remain enabled`,
        });
      }
    }

    const normalizedLabels = value.statuses.map((status) => status.label.toLowerCase());

    if (new Set(normalizedLabels).size !== normalizedLabels.length) {
      ctx.addIssue({
        code: "custom",
        path: ["statuses"],
        message: "Status labels must be unique",
      });
    }
  });

export type UpdateTaskWorkflowInput = z.infer<typeof updateTaskWorkflowSchema>;
