import { apiFetch } from "@/lib/api";

import type { CreateTaskInput, ProjectTasksResponse, TaskResponse } from "../types";

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
