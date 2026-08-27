import { useQuery } from "@tanstack/react-query";
import { getDiscordIntegration } from "../api/discord-integration";

export const discordIntegrationQueryKey = ["integrations", "discord"] as const;

export function useDiscordIntegration() {
  return useQuery({
    queryKey: discordIntegrationQueryKey,

    queryFn: getDiscordIntegration,

    retry: false,
  });
}
