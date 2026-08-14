import { useQuery } from "@tanstack/react-query";

import { getMembers } from "../api/members";

export const membersQueryKey = ["members"] as const;

export function useMembers() {
  return useQuery({
    queryKey: membersQueryKey,
    queryFn: getMembers,
  });
}
