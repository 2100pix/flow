import { useMutation, useQueryClient } from "@tanstack/react-query";

import { disconnectDiscordIntegration } from "../api/discord-integration";

import { discordIntegrationQueryKey } from "./use-discord-integration";

export function useDisconnectDiscordIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectDiscordIntegration,

    onSuccess: (integration) => {
      queryClient.setQueryData(discordIntegrationQueryKey, integration);
    },
  });
}
