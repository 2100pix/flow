import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectQueryKey } from "@/features/projects/hooks/use-project";
import { projectsQueryKey } from "@/features/projects/hooks/use-projects";

import { removeProjectMember } from "../api/members";
import { projectMembersQueryKey } from "./use-project-members";

type RemoveVariables = {
  projectId: string;
  userId: string;
};

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, userId }: RemoveVariables) => removeProjectMember(projectId, userId),

    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectMembersQueryKey(variables.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: projectQueryKey(variables.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: projectsQueryKey,
        }),
      ]);
    },
  });
}
