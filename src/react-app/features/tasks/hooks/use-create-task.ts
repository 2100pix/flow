import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTask } from "../api/tasks";
import type { CreateTaskInput } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";

type CreateTaskVariables = {
  projectId: string;
  input: CreateTaskInput;
};

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: CreateTaskVariables) => createTask(projectId, input),

    onSuccess: async (_task, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectTasksQueryKey(variables.projectId),
      });
    },
  });
}
