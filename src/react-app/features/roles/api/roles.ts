import { apiFetch } from "@/lib/api";
import type { CreateRoleInput, DeleteRoleResponse, ReorderRolesInput, ReorderRolesResponse, RoleResponse, RolesResponse, UpdateRoleInput } from "../types";

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

export async function reorderRoles(input: ReorderRolesInput) {
  return apiFetch<ReorderRolesResponse>("/api/roles/reorder", {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });
}

export async function deleteRole(roleId: string) {
  return apiFetch<DeleteRoleResponse>(`/api/roles/${roleId}`, {
    method: "DELETE",
  });
}
