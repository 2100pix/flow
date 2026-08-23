import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meQueryKey } from "@/features/auth/hooks/use-me";

import { removeWorkspaceMember } from "../api/members";

import { membersQueryKey } from "./use-members";

async function invalidateMemberDependencies(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: membersQueryKey,
    }),

    queryClient.invalidateQueries({
      queryKey: meQueryKey,
    }),

    queryClient.invalidateQueries({
      queryKey: ["teams"],
    }),

    queryClient.invalidateQueries({
      queryKey: ["projects"],
    }),

    queryClient.invalidateQueries({
      queryKey: ["tasks"],
    }),
  ]);
}

export function useRemoveWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeWorkspaceMember(userId),

    onSuccess: async () => {
      await invalidateMemberDependencies(queryClient);
    },
  });
}
