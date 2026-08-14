import { apiFetch } from "@/lib/api";

import type { DashboardResponse } from "../types";

export async function getDashboard() {
  const response = await apiFetch<DashboardResponse>("/api/dashboard");

  return response.data;
}
