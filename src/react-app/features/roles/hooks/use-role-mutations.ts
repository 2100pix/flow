import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRole, deleteRole, reorderRoles, updateRole } from "../api/roles";
import type { ReorderRolesInput } from "../types";

import type { PermissionKey } from "../../../../shared/permissions";
import { rolesQueryKey } from "./use-roles";

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRole,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey,
      });
    },
  });
}
export function useReorderRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderRolesInput) => reorderRoles(input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey,
      });
    },
  });
}
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, name, permissions }: { roleId: string; name: string; permissions: PermissionKey[] }) =>
      updateRole(roleId, {
        name,
        permissions,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey,
      });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRole,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey,
      });
    },
  });
}
