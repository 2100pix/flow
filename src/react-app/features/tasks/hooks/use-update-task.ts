import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTask } from "../api/tasks";
import type { TaskDto, UpdateTaskInput } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";
import { taskQueryKey } from "./use-task";
import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";

type UpdateTaskVariables = {
  taskId: string;
  input: UpdateTaskInput;
};

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, input }: UpdateTaskVariables) => updateTask(taskId, input),

    onSuccess: async (task) => {
      queryClient.setQueryData(taskQueryKey(task.id), task);

      queryClient.setQueryData<TaskDto[]>(projectTasksQueryKey(task.projectId), (existing) => {
        if (!existing) {
          return existing;
        }

        return existing.map((item) => (item.id === task.id ? task : item));
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectTasksQueryKey(task.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: dashboardQueryKey,
        }),
      ]);
      await queryClient.invalidateQueries({
        queryKey: projectTasksQueryKey(task.projectId),
      });
    },
  });
}
