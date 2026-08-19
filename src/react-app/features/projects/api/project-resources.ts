import { apiFetch } from "@/lib/api";

import type { CreateProjectResourceInput, ProjectResourceResponse, ProjectResourcesResponse, UpdateProjectResourceInput } from "../types";

type DeleteProjectResourceResponse = {
  data: {
    success: true;
  };
};

export async function getProjectResources(projectId: string) {
  const response = await apiFetch<ProjectResourcesResponse>(`/api/projects/${projectId}/resources`);

  return response.data;
}

export async function createProjectResource(projectId: string, input: CreateProjectResourceInput) {
  const response = await apiFetch<ProjectResourceResponse>(`/api/projects/${projectId}/resources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateProjectResource(projectId: string, resourceId: string, input: UpdateProjectResourceInput) {
  const response = await apiFetch<ProjectResourceResponse>(`/api/projects/${projectId}/resources/${resourceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function deleteProjectResource(projectId: string, resourceId: string) {
  return apiFetch<DeleteProjectResourceResponse>(`/api/projects/${projectId}/resources/${resourceId}`, {
    method: "DELETE",
  });
}
