import { useQuery } from "@tanstack/react-query";

import { getPendingAccessStatus } from "../api/auth";

export const pendingAccessStatusQueryKey = ["auth", "pending-access-status"] as const;

export function usePendingAccessStatus() {
  return useQuery({
    queryKey: pendingAccessStatusQueryKey,
    queryFn: getPendingAccessStatus,

    refetchInterval: (query) => (query.state.data === "pending" ? 5000 : false),

    retry: false,
  });
}
