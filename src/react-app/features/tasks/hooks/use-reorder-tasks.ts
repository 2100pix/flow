import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reorderProjectTasks } from "../api/tasks";
import type { ReorderTasksInput } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";

type ReorderVariables = {
  projectId: string;
  input: ReorderTasksInput;
};

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: ReorderVariables) => reorderProjectTasks(projectId, input),

    onSettled: async (_response, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectTasksQueryKey(variables.projectId),
      });
    },
  });
}
