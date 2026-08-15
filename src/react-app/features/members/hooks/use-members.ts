import { useQuery } from "@tanstack/react-query";

import { getMembers } from "../api/members";

export const membersQueryKey = ["members"] as const;

export function useMembers(enabled = true) {
  return useQuery({
    queryKey: membersQueryKey,

    queryFn: getMembers,

    enabled,
  });
}
