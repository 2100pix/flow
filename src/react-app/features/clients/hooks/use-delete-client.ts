import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteClient } from "../api/clients";
import { clientQueryKey } from "./use-client";
import { clientsQueryKey } from "./use-clients";

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteClient,

    onSuccess: async (_response, clientId) => {
      queryClient.removeQueries({
        queryKey: clientQueryKey(clientId),
      });

      await queryClient.invalidateQueries({
        queryKey: clientsQueryKey,
      });
    },
  });
}
