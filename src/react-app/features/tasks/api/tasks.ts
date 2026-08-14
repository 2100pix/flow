import { apiFetch } from "@/lib/api";

import type { ArchiveTaskResponse, CreateTaskInput, ProjectTasksResponse, TaskResponse, UpdateTaskInput } from "../types";

export async function getProjectTasks(projectId: string) {
  const response = await apiFetch<ProjectTasksResponse>(`/api/projects/${projectId}/tasks`);

  return response.data;
}

export async function createTask(projectId: string, input: CreateTaskInput) {
  const response = await apiFetch<TaskResponse>(`/api/projects/${projectId}/tasks`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getTask(taskId: string) {
  const response = await apiFetch<TaskResponse>(`/api/tasks/${taskId}`);

  return response.data;
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const response = await apiFetch<TaskResponse>(`/api/tasks/${taskId}`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function archiveTask(taskId: string) {
  return apiFetch<ArchiveTaskResponse>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}
