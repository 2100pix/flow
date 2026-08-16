import { ApiError, apiFetch } from "@/lib/api";

import type { AuthContext, LogoutResponse, MeResponse, PendingAccessCompleteResponse, PendingAccessStatusResponse } from "../types";

export async function getPendingAccessStatus() {
  const response = await apiFetch<PendingAccessStatusResponse>("/api/auth/pending/status");

  return response.data.status;
}

export async function completePendingAccess() {
  return apiFetch<PendingAccessCompleteResponse>("/api/auth/pending/complete", {
    method: "POST",
  });
}

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
