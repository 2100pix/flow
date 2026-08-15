import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meQueryKey } from "@/features/auth/hooks/use-me";

import { updateMemberRole } from "../api/update-member-role";

import type { UpdateWorkspaceMemberRoleInput } from "../types";

import { membersQueryKey } from "./use-members";

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateWorkspaceMemberRoleInput }) => updateMemberRole(userId, input),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: membersQueryKey,
        }),

        queryClient.invalidateQueries({
          queryKey: meQueryKey,
        }),
      ]);
    },
  });
}
