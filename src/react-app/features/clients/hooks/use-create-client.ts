import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../api/clients";
import { clientsQueryKey } from "./use-clients";

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: clientsQueryKey,
      });
    },
  });
}
