import { apiFetch } from "@/lib/api";

import type {
  AddProjectMemberInput,
  MemberAccessRequestsResponse,
  MemberResponse,
  MembersResponse,
  ProjectMemberResponse,
  ProjectMembersResponse,
  RejectMemberAccessRequestResponse,
  RemoveProjectMemberResponse,
  RemoveWorkspaceMemberResponse,
  CreateWorkspaceExpertiseInput,
  UpdateMemberExpertiseInput,
  WorkspaceExpertiseItemResponse,
  WorkspaceExpertiseResponse,
} from "../types";

export async function getMembers() {
  const response = await apiFetch<MembersResponse>("/api/members");

  return response.data;
}

export async function getWorkspaceExpertise() {
  const response = await apiFetch<WorkspaceExpertiseResponse>("/api/members/expertise");

  return response.data;
}

export async function createWorkspaceExpertise(input: CreateWorkspaceExpertiseInput) {
  const response = await apiFetch<WorkspaceExpertiseItemResponse>("/api/members/expertise", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateMemberExpertise(userId: string, input: UpdateMemberExpertiseInput) {
  return apiFetch(`/api/members/${userId}/expertise`, {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });
}

export async function removeWorkspaceMember(userId: string) {
  return apiFetch<RemoveWorkspaceMemberResponse>(`/api/members/${userId}`, {
    method: "DELETE",
  });
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

export async function getMemberAccessRequests() {
  const response = await apiFetch<MemberAccessRequestsResponse>("/api/members/access-requests");

  return response.data;
}

export async function approveMemberAccessRequest(userId: string) {
  const response = await apiFetch<MemberResponse>(`/api/members/access-requests/${userId}/approve`, {
    method: "POST",
  });

  return response.data;
}

export async function rejectMemberAccessRequest(userId: string) {
  return apiFetch<RejectMemberAccessRequestResponse>(`/api/members/access-requests/${userId}`, {
    method: "DELETE",
  });
}
