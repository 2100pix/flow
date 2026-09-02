import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateClient } from "../api/clients";
import type { UpdateClientInput } from "../types";
import { clientQueryKey } from "./use-client";
import { clientsQueryKey } from "./use-clients";

type UpdateClientVariables = {
  clientId: string;
  input: UpdateClientInput;
};

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, input }: UpdateClientVariables) => updateClient(clientId, input),

    onSuccess: async (client) => {
      queryClient.setQueryData(clientQueryKey(client.id), client);

      await queryClient.invalidateQueries({
        queryKey: clientsQueryKey,
      });
    },
  });
}
