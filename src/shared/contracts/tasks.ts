import * as z from "zod";

export const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "review", "done", "cancelled"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),

  status: taskStatusSchema.optional(),
});

export const taskDiscordThreadUrlSchema = z.url().refine(
  (value) => {
    const url = new URL(value);

    return url.protocol === "https:" && (url.hostname === "discord.com" || url.hostname === "www.discord.com") && url.pathname.startsWith("/channels/");
  },
  {
    message: "Must be a Discord thread URL",
  },
);

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),

    description: z.string().trim().max(5000).nullable().optional(),

    status: taskStatusSchema.optional(),

    priority: taskPrioritySchema.nullable().optional(),

    assigneeId: z.string().trim().min(1).nullable().optional(),

    dueDate: z.iso.date().nullable().optional(),

    discordThreadUrl: taskDiscordThreadUrlSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export type ArchiveTaskResponse = {
  data: {
    success: true;
  };
};
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type TaskAssigneeDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type TaskDto = {
  id: string;
  projectId: string;

  title: string;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority | null;

  assignee: TaskAssigneeDto | null;

  dueDate: string | null;
  sortOrder: number;

  discordThreadUrl: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ProjectTasksResponse = {
  data: TaskDto[];
};

export type TaskResponse = {
  data: TaskDto;
};

export const reorderTaskColumnSchema = z.object({
  status: taskStatusSchema,

  taskIds: z.array(z.string().trim().min(1)),
});

export const reorderTasksSchema = z
  .object({
    columns: z.array(reorderTaskColumnSchema).min(1).max(2),
  })
  .superRefine((value, ctx) => {
    const statuses = value.columns.map((column) => column.status);

    if (new Set(statuses).size !== statuses.length) {
      ctx.addIssue({
        code: "custom",
        path: ["columns"],
        message: "Column statuses must be unique",
      });
    }

    const taskIds = value.columns.flatMap((column) => column.taskIds);

    if (new Set(taskIds).size !== taskIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["columns"],
        message: "Task IDs must be unique",
      });
    }
  });

export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;

export type ReorderTasksResponse = {
  data: {
    success: true;
  };
};
