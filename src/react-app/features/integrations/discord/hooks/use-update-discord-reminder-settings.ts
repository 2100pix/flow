import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDiscordReminderSettings } from "../api/discord-integration";
import { discordIntegrationQueryKey } from "./use-discord-integration";

export function useUpdateDiscordReminderSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDiscordReminderSettings,

    onSuccess: (integration) => {
      queryClient.setQueryData(discordIntegrationQueryKey, integration);
    },
  });
}
