import { useMutation, useQueryClient } from "@tanstack/react-query";

import { archiveTask } from "../api/tasks";
import type { TaskDto } from "../types";
import { projectTasksQueryKey } from "./use-project-tasks";
import { taskQueryKey } from "./use-task";

type ArchiveVariables = {
  taskId: string;
  projectId: string;
};

export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: ArchiveVariables) => archiveTask(taskId),

    onSuccess: async (_response, variables) => {
      queryClient.removeQueries({
        queryKey: taskQueryKey(variables.taskId),
      });

      queryClient.setQueryData<TaskDto[]>(projectTasksQueryKey(variables.projectId), (existing) => existing?.filter((task) => task.id !== variables.taskId));

      await queryClient.invalidateQueries({
        queryKey: projectTasksQueryKey(variables.projectId),
      });
    },
  });
}
