import { useMutation, useQueryClient } from "@tanstack/react-query";

import { archiveClient } from "../api/clients";
import { clientQueryKey } from "./use-client";
import { clientsQueryKey } from "./use-clients";

export function useArchiveClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveClient,

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
