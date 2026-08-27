import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDiscordWorkspaceRole } from "../api/discord-integration";
import { discordIntegrationQueryKey } from "./use-discord-integration";

export function useUpdateDiscordWorkspaceRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDiscordWorkspaceRole,

    onSuccess: (integration) => {
      queryClient.setQueryData(discordIntegrationQueryKey, integration);
    },
  });
}
