import { apiFetch } from "@/lib/api";

import type { ArchiveProjectResponse, CreateProjectInput, ProjectResponse, ProjectsResponse, UpdateProjectInput } from "../types";

export async function getProjects() {
  const response = await apiFetch<ProjectsResponse>("/api/projects");

  return response.data;
}

export async function createProject(input: CreateProjectInput) {
  const response = await apiFetch<ProjectResponse>("/api/projects", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getProject(projectId: string) {
  const response = await apiFetch<ProjectResponse>(`/api/projects/${projectId}`);

  return response.data;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const response = await apiFetch<ProjectResponse>(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function archiveProject(projectId: string) {
  return apiFetch<ArchiveProjectResponse>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}
