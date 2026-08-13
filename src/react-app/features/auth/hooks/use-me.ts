import { useQuery } from "@tanstack/react-query";

import { getMe } from "../api/auth";

export const meQueryKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    retry: false,
  });
}
