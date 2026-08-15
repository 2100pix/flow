import { apiFetch } from "@/lib/api";

import type { MemberResponse, UpdateWorkspaceMemberRoleInput } from "../types";

export async function updateMemberRole(userId: string, input: UpdateWorkspaceMemberRoleInput) {
  const response = await apiFetch<MemberResponse>(`/api/members/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}
