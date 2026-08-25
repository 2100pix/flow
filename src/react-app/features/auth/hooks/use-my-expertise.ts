import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createMyExpertise, getMyExpertise, updateMyExpertise } from "../api/auth";
import type { AuthContext, ProfileExpertiseItem } from "../types";
import type { WorkspaceExpertiseDto } from "../../../../shared/contracts/members";

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

function toProfileExpertise(tags: WorkspaceExpertiseDto[] | undefined, expertiseIds: string[]): ProfileExpertiseItem[] {
  if (!tags) {
    return [];
  }

  return tags
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
      const tags = queryClient.getQueryData<WorkspaceExpertiseDto[]>(myExpertiseQueryKey);

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
