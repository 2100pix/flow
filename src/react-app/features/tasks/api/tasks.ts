import { apiFetch } from "@/lib/api";

import type { ArchiveTaskResponse, CreateTaskInput, ProjectTasksResponse, ReorderTasksInput, ReorderTasksResponse, TaskResponse, TaskWorkflowResponse, UpdateTaskInput, UpdateTaskWorkflowInput } from "../types";

export async function getProjectTaskWorkflow(projectId: string) {
  const response = await apiFetch<TaskWorkflowResponse>(`/api/projects/${projectId}/task-workflow`);

  return response.data;
}

export async function updateProjectTaskWorkflow(projectId: string, input: UpdateTaskWorkflowInput) {
  const response = await apiFetch<TaskWorkflowResponse>(`/api/projects/${projectId}/task-workflow`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

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

export async function reorderProjectTasks(projectId: string, input: ReorderTasksInput) {
  return apiFetch<ReorderTasksResponse>(`/api/projects/${projectId}/tasks/reorder`, {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });
}
