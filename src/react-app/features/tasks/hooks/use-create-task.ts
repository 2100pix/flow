import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTask } from "../api/tasks";
import type { CreateTaskInput } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";
import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";

type CreateTaskVariables = {
  projectId: string;
  input: CreateTaskInput;
};

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: CreateTaskVariables) => createTask(projectId, input),

    onSuccess: async (_task, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectTasksQueryKey(variables.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: dashboardQueryKey,
        }),
      ]);
    },
  });
}
