import { apiFetch } from "@/lib/api";

import type { AddTeamMemberInput, CreateTeamInput, DeleteTeamResponse, RemoveTeamMemberResponse, TeamMemberResponse, TeamResponse, TeamsResponse, UpdateTeamInput } from "../types";

export async function getTeams() {
  const response = await apiFetch<TeamsResponse>("/api/teams");

  return response.data;
}

export async function createTeam(input: CreateTeamInput) {
  const response = await apiFetch<TeamResponse>("/api/teams", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateTeam(teamId: string, input: UpdateTeamInput) {
  const response = await apiFetch<TeamResponse>(`/api/teams/${teamId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function deleteTeam(teamId: string) {
  return apiFetch<DeleteTeamResponse>(`/api/teams/${teamId}`, {
    method: "DELETE",
  });
}

export async function addTeamMember(teamId: string, input: AddTeamMemberInput) {
  const response = await apiFetch<TeamMemberResponse>(`/api/teams/${teamId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function removeTeamMember(teamId: string, userId: string) {
  return apiFetch<RemoveTeamMemberResponse>(`/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}
