import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addTeamMember, createTeam, deleteTeam, removeTeamMember, updateTeam } from "../api/teams";
import { teamsQueryKey } from "./use-teams";

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeam,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamsQueryKey,
      });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      updateTeam(teamId, {
        name,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamsQueryKey,
      });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTeam,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamsQueryKey,
      });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      addTeamMember(teamId, {
        userId,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamsQueryKey,
      });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => removeTeamMember(teamId, userId),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamsQueryKey,
      });
    },
  });
}
