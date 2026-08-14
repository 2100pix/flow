import { apiFetch } from "@/lib/api";

import type { AddProjectMemberInput, MembersResponse, ProjectMemberResponse, ProjectMembersResponse, RemoveProjectMemberResponse } from "../types";

export async function getMembers() {
  const response = await apiFetch<MembersResponse>("/api/members");

  return response.data;
}

export async function getProjectMembers(projectId: string) {
  const response = await apiFetch<ProjectMembersResponse>(`/api/projects/${projectId}/members`);

  return response.data;
}

export async function addProjectMember(projectId: string, input: AddProjectMemberInput) {
  const response = await apiFetch<ProjectMemberResponse>(`/api/projects/${projectId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function removeProjectMember(projectId: string, userId: string) {
  return apiFetch<RemoveProjectMemberResponse>(`/api/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}
