import { useQuery } from "@tanstack/react-query";

import { getClients } from "../api/clients";

export const clientsQueryKey = ["clients"] as const;

export function useClients(enabled = true) {
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: getClients,
    enabled,
  });
}
