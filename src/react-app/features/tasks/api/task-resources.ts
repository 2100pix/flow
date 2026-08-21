import { apiFetch } from "@/lib/api";

import type { CreateTaskResourceInput, DeleteTaskResourceResponse, TaskResourceResponse, TaskResourcesResponse, UpdateTaskResourceInput } from "../types";

export async function getTaskResources(taskId: string) {
  const response = await apiFetch<TaskResourcesResponse>(`/api/tasks/${taskId}/resources`);

  return response.data;
}

export async function createTaskResource(taskId: string, input: CreateTaskResourceInput) {
  const response = await apiFetch<TaskResourceResponse>(`/api/tasks/${taskId}/resources`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateTaskResource(taskId: string, resourceId: string, input: UpdateTaskResourceInput) {
  const response = await apiFetch<TaskResourceResponse>(`/api/tasks/${taskId}/resources/${resourceId}`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function deleteTaskResource(taskId: string, resourceId: string) {
  return apiFetch<DeleteTaskResourceResponse>(`/api/tasks/${taskId}/resources/${resourceId}`, {
    method: "DELETE",
  });
}
