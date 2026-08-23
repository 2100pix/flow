import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createMyExpertise, getMyExpertise, updateMyExpertise } from "../api/auth";
import type { AuthContext, ProfileExpertiseItem } from "../types";

import { meQueryKey } from "./use-me";

export const myExpertiseQueryKey = ["me", "expertise"] as const;

export function useMyExpertise() {
  return useQuery({
    queryKey: myExpertiseQueryKey,

    queryFn: getMyExpertise,
  });
}

export function useCreateMyExpertise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMyExpertise,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: myExpertiseQueryKey,
      });
    },
  });
}

function toProfileExpertise(tags: unknown, expertiseIds: string[]): ProfileExpertiseItem[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag): tag is ProfileExpertiseItem & { name: string } => Boolean(tag) && typeof tag === "object" && typeof (tag as ProfileExpertiseItem).id === "string" && typeof (tag as ProfileExpertiseItem).name === "string")
    .filter((tag) => expertiseIds.includes(tag.id))
    .map((tag) => ({
      id: tag.id,

      name: tag.name,
    }));
}

export function useUpdateMyExpertise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expertiseIds }: { expertiseIds: string[] }) =>
      updateMyExpertise({
        expertiseIds,
      }),

    onSuccess: (_data, variables) => {
      const tags = queryClient.getQueryData(myExpertiseQueryKey);

      const expertise = toProfileExpertise(tags, variables.expertiseIds);

      queryClient.setQueryData<AuthContext | null>(meQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          user: {
            ...current.user,

            expertise,
          },
        };
      });
    },
  });
}
