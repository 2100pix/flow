import { ApiError, apiFetch } from "@/lib/api";

import type { AuthContext, LogoutResponse, MeResponse, PendingAccessContinueResponse } from "../types";

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
