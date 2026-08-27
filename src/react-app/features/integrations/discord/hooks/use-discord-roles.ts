import { useQuery } from "@tanstack/react-query";
import { getDiscordRoles } from "../api/discord-integration";

export const discordRolesQueryKey = ["integrations", "discord", "roles"] as const;

export function useDiscordRoles(enabled: boolean) {
  return useQuery({
    queryKey: discordRolesQueryKey,

    queryFn: getDiscordRoles,

    enabled,

    retry: false,
  });
}
