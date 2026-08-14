import { useQuery } from "@tanstack/react-query";

import { getProjectTasks } from "../api/tasks";

export function projectTasksQueryKey(projectId: string | undefined) {
  return ["projects", projectId, "tasks"] as const;
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: projectTasksQueryKey(projectId),

    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      return getProjectTasks(projectId);
    },

    enabled: Boolean(projectId),
  });
}
