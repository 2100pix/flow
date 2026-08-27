import { useQuery } from "@tanstack/react-query";
import { getDiscordCategories } from "../api/discord-integration";

export const discordCategoriesQueryKey = ["integrations", "discord", "categories"] as const;

export function useDiscordCategories(enabled: boolean) {
  return useQuery({
    queryKey: discordCategoriesQueryKey,

    queryFn: getDiscordCategories,

    enabled,

    retry: false,
  });
}
