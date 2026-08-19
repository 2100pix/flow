import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectMembersQueryKey } from "@/features/members/hooks/use-project-members";

import { replaceProjectLeads } from "../api/projects";
import { projectQueryKey } from "./use-project";
import { projectsQueryKey } from "./use-projects";

type UpdateProjectLeadsVariables = {
  projectId: string;
  userIds: string[];
};

export function useUpdateProjectLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, userIds }: UpdateProjectLeadsVariables) =>
      replaceProjectLeads(projectId, {
        userIds,
      }),

    onSuccess: async (_leads, variables) => {
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
