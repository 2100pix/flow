import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meQueryKey } from "@/features/auth/hooks/use-me";

import { removeWorkspaceMember, updateWorkspaceMember } from "../api/members";

import type { UpdateWorkspaceMemberInput } from "../types";

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

export function useUpdateWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;

      input: UpdateWorkspaceMemberInput;
    }) => updateWorkspaceMember(userId, input),

    onSuccess: async () => {
      await invalidateMemberDependencies(queryClient);
    },
  });
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
