import { useQuery } from "@tanstack/react-query";

import { getMemberAccessRequests } from "../api/members";

export const memberAccessRequestsQueryKey = ["members", "access-requests"] as const;

export function useMemberAccessRequests(enabled: boolean) {
  return useQuery({
    queryKey: memberAccessRequestsQueryKey,
    queryFn: getMemberAccessRequests,
    enabled,
  });
}
