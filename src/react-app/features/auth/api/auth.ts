import { ApiError, apiFetch } from "@/lib/api";

import type { CreateWorkspaceExpertiseInput, UpdateMemberExpertiseInput, WorkspaceExpertiseDto } from "../../../../shared/contracts/members";
import type { AuthContext, LogoutResponse, MeResponse, PendingAccessContinueResponse, UpdateProfileInput, UpdateProfileResponse, UserProfileDto } from "../types";

export async function getMe(): Promise<AuthContext | null> {
  try {
    const response = await apiFetch<MeResponse>("/api/me");

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function logout() {
  return apiFetch<LogoutResponse>("/api/auth/logout", {
    method: "POST",
  });
}

export async function continuePendingAccess() {
  return apiFetch<PendingAccessContinueResponse>("/api/auth/pending/continue", {
    method: "POST",
  });
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<UserProfileDto> {
  const response = await apiFetch<UpdateProfileResponse>("/api/me/profile", {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getMyExpertise(): Promise<WorkspaceExpertiseDto[]> {
  const response = await apiFetch<{ data: WorkspaceExpertiseDto[] }>("/api/me/expertise");

  return response.data;
}

export async function createMyExpertise(input: CreateWorkspaceExpertiseInput): Promise<WorkspaceExpertiseDto> {
  const response = await apiFetch<{ data: WorkspaceExpertiseDto }>("/api/me/expertise", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateMyExpertise(input: UpdateMemberExpertiseInput) {
  return apiFetch<{ data: { success: true } }>("/api/me/expertise", {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });
}

export async function refreshMyDiscordProfile(): Promise<UserProfileDto> {
  const response = await apiFetch<UpdateProfileResponse>("/api/me/discord-refresh", {
    method: "POST",
  });

  return response.data;
}
