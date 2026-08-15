import { apiFetch } from "@/lib/api";

import type { CreateRoleInput, DeleteRoleResponse, RoleResponse, RolesResponse, UpdateRoleInput } from "../types";

export async function getRoles() {
  const response = await apiFetch<RolesResponse>("/api/roles");

  return response.data;
}

export async function createRole(input: CreateRoleInput) {
  const response = await apiFetch<RoleResponse>("/api/roles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateRole(roleId: string, input: UpdateRoleInput) {
  const response = await apiFetch<RoleResponse>(`/api/roles/${roleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function deleteRole(roleId: string) {
  return apiFetch<DeleteRoleResponse>(`/api/roles/${roleId}`, {
    method: "DELETE",
  });
}
