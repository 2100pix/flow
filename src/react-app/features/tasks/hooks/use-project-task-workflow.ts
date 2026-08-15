import { useQuery } from "@tanstack/react-query";

import { getProjectTaskWorkflow } from "../api/tasks";

export function projectTaskWorkflowQueryKey(projectId: string | undefined) {
  return ["projects", projectId, "task-workflow"] as const;
}

export function useProjectTaskWorkflow(projectId: string | undefined) {
  return useQuery({
    queryKey: projectTaskWorkflowQueryKey(projectId),

    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      return getProjectTaskWorkflow(projectId);
    },

    enabled: Boolean(projectId),
  });
}
