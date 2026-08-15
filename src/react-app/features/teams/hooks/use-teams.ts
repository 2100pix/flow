import { useQuery } from "@tanstack/react-query";

import { getTeams } from "../api/teams";

export const teamsQueryKey = ["teams"] as const;

export function useTeams() {
  return useQuery({
    queryKey: teamsQueryKey,
    queryFn: getTeams,
  });
}
