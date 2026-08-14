import { useMutation, useQueryClient } from "@tanstack/react-query";

import { archiveProject } from "../api/projects";
import { projectQueryKey } from "./use-project";
import { projectsQueryKey } from "./use-projects";

export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveProject,

    onSuccess: async (_response, projectId) => {
      queryClient.removeQueries({
        queryKey: projectQueryKey(projectId),
      });

      await queryClient.invalidateQueries({
        queryKey: projectsQueryKey,
      });
    },
  });
}
