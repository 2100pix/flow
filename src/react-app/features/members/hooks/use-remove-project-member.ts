import { useMutation, useQueryClient } from "@tanstack/react-query";

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
      await queryClient.invalidateQueries({
        queryKey: projectMembersQueryKey(variables.projectId),
      });
    },
  });
}
