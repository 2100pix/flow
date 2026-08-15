import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "../api/dashboard";

export const dashboardQueryKey = ["dashboard"] as const;

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: dashboardQueryKey,

    queryFn: getDashboard,

    enabled,

    staleTime: 0,

    refetchOnMount: "always",
  });
}
