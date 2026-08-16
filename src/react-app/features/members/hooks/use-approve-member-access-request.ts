import { useMutation, useQueryClient } from "@tanstack/react-query";

import { approveMemberAccessRequest } from "../api/members";

import { memberAccessRequestsQueryKey } from "./use-member-access-requests";
import { membersQueryKey } from "./use-members";

export function useApproveMemberAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => approveMemberAccessRequest(userId),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: membersQueryKey,
        }),

        queryClient.invalidateQueries({
          queryKey: memberAccessRequestsQueryKey,
        }),
      ]);
    },
  });
}
