import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createWorkspaceExpertise, getWorkspaceExpertise, updateMemberExpertise } from "../api/members";

import { membersQueryKey } from "./use-members";

export const workspaceExpertiseQueryKey = ["members", "expertise"] as const;

export function useWorkspaceExpertise() {
  return useQuery({
    queryKey: workspaceExpertiseQueryKey,

    queryFn: getWorkspaceExpertise,
  });
}

export function useCreateWorkspaceExpertise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspaceExpertise,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceExpertiseQueryKey,
      });
    },
  });
}

export function useUpdateMemberExpertise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      expertiseIds,
    }: {
      userId: string;

      expertiseIds: string[];
    }) =>
      updateMemberExpertise(userId, {
        expertiseIds,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: membersQueryKey,
      });
    },
  });
}
