import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDiscordIntegration } from "../api/discord-integration";

import { discordIntegrationQueryKey } from "./use-discord-integration";

export function useUpdateDiscordIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDiscordIntegration,

    onSuccess: (integration) => {
      queryClient.setQueryData(discordIntegrationQueryKey, integration);
    },
  });
}
