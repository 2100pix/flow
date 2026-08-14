import { useQuery } from "@tanstack/react-query";

import { getProject } from "../api/projects";

export function projectQueryKey(projectId: string | undefined) {
  return ["projects", projectId] as const;
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectQueryKey(projectId),

    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      return getProject(projectId);
    },

    enabled: Boolean(projectId),
  });
}
