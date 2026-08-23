import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshMyDiscordProfile } from "../api/auth";
import type { AuthContext } from "../types";

import { meQueryKey } from "./use-me";

export function useRefreshDiscordProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshMyDiscordProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData<AuthContext | null>(meQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          user: {
            ...current.user,

            displayName: profile.displayName,

            avatarUrl: profile.avatarUrl,
          },
        };
      });
    },
  });
}
