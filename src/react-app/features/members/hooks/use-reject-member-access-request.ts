import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rejectMemberAccessRequest } from "../api/members";

import { memberAccessRequestsQueryKey } from "./use-member-access-requests";

export function useRejectMemberAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => rejectMemberAccessRequest(userId),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: memberAccessRequestsQueryKey,
      });
    },
  });
}
