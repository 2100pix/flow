import { useQuery } from "@tanstack/react-query";
import { getClient } from "../api/clients";

export function clientQueryKey(clientId: string | undefined) {
  return ["clients", clientId] as const;
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: clientQueryKey(clientId),

    queryFn: () => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      return getClient(clientId);
    },

    enabled: Boolean(clientId),
  });
}
