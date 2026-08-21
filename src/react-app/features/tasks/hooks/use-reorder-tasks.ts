import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";

import { reorderProjectTasks } from "../api/tasks";

import type { ReorderTasksInput, TaskDto } from "../types";

import { projectTasksQueryKey } from "./use-project-tasks";

import { taskQueryKey } from "./use-task";

type ReorderVariables = {
  projectId: string;

  input: ReorderTasksInput;
};

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: ReorderVariables) => reorderProjectTasks(projectId, input),

    onMutate: (variables) => {
      for (const column of variables.input.columns) {
        column.taskIds.forEach((taskId, index) => {
          queryClient.setQueryData<TaskDto>(taskQueryKey(taskId), (existing) => {
            if (!existing) {
              return existing;
            }

            return {
              ...existing,

              status: column.status,

              sortOrder: (index + 1) * 100,
            };
          });
        });
      }
    },

    onSettled: async (_response, _error, variables) => {
      const affectedTaskIds = Array.from(new Set(variables.input.columns.flatMap((column) => column.taskIds)));

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectTasksQueryKey(variables.projectId),
        }),

        ...affectedTaskIds.map((taskId) =>
          queryClient.invalidateQueries({
            queryKey: taskQueryKey(taskId),
          }),
        ),

        queryClient.invalidateQueries({
          queryKey: dashboardQueryKey,
        }),
      ]);
    },
  });
}
