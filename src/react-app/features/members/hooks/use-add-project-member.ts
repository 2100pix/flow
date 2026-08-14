import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addProjectMember } from "../api/members";
import { projectMembersQueryKey } from "./use-project-members";

type AddVariables = {
  projectId: string;
  userId: string;
};

export function useAddProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, userId }: AddVariables) =>
      addProjectMember(projectId, {
        userId,
      }),

    onSuccess: async (_member, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectMembersQueryKey(variables.projectId),
      });
    },
  });
}
