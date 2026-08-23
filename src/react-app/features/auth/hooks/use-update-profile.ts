import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMyProfile } from "../api/auth";
import type { AuthContext } from "../types";

import { meQueryKey } from "./use-me";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData<AuthContext | null>(meQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          user: {
            ...current.user,

            firstName: profile.firstName,

            lastName: profile.lastName,

            timeZone: profile.timeZone,
          },
        };
      });
    },
  });
}
