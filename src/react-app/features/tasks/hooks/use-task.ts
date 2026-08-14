import { useQuery } from "@tanstack/react-query";

import { getTask } from "../api/tasks";

export function taskQueryKey(taskId: string | undefined) {
  return ["tasks", taskId] as const;
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: taskQueryKey(taskId),

    queryFn: () => {
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      return getTask(taskId);
    },

    enabled: Boolean(taskId),
  });
}
