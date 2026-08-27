import { apiFetch } from "@/lib/api";

import type { TaskActivityPage } from "../types";

export async function getTaskActivity(taskId: string, cursor: string | null, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await apiFetch<TaskActivityPage>(`/api/tasks/${taskId}/activity?${params.toString()}`);

  return response;
}