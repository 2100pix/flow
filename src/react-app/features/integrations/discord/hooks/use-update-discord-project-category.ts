import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDiscordProjectCategory } from "../api/discord-integration";
import { discordIntegrationQueryKey } from "./use-discord-integration";

export function useUpdateDiscordProjectCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDiscordProjectCategory,

    onSuccess: (integration) => {
      queryClient.setQueryData(discordIntegrationQueryKey, integration);
    },
  });
}
