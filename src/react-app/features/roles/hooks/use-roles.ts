import { useQuery } from "@tanstack/react-query";

import { getRoles } from "../api/roles";

export const rolesQueryKey = ["roles"] as const;

export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: getRoles,
  });
}
