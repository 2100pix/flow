import * as z from "zod";

export const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "review", "done"]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),

  status: taskStatusSchema.optional(),
});

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
