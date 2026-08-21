import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";
import { deleteTask } from "../api/tasks";
import type { TaskDto } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";
import { taskQueryKey } from "./use-task";
import { taskResourcesQueryKey } from "./use-task-resources";
import { projectQueryKey } from "@/features/projects/hooks/use-project";

type DeleteVariables = {
  taskId: string;
  projectId: string;
};

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: DeleteVariables) => deleteTask(taskId),

    onSuccess: async (_response, variables) => {
      queryClient.removeQueries({
        queryKey: taskQueryKey(variables.taskId),
      });
      queryClient.removeQueries({
        queryKey: taskResourcesQueryKey(variables.taskId),
      });
      queryClient.setQueryData<TaskDto[]>(projectTasksQueryKey(variables.projectId), (existing) => existing?.filter((task) => task.id !== variables.taskId));

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectTasksQueryKey(variables.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: projectQueryKey(variables.projectId),
        }),

        queryClient.invalidateQueries({
          queryKey: dashboardQueryKey,
        }),
      ]);
    },
  });
}
