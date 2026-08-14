import { useQuery } from "@tanstack/react-query";

import { getClients } from "../api/clients";

export const clientsQueryKey = ["clients"] as const;

export function useClients() {
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: getClients,
  });
}
