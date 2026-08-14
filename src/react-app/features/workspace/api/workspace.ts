import { apiFetch } from "@/lib/api";

import type { UpdateWorkspaceInput, WorkspaceResponse } from "../types";

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const response = await apiFetch<WorkspaceResponse>("/api/workspace", {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}
