import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";
import { deleteProject } from "../api/projects";
import { projectQueryKey } from "./use-project";
import { projectsQueryKey } from "./use-projects";

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,

    onSuccess: async (_response, projectId) => {
      queryClient.removeQueries({
        queryKey: projectQueryKey(projectId),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectsQueryKey,
        }),

        queryClient.invalidateQueries({
          queryKey: dashboardQueryKey,
        }),
      ]);
    },
  });
}
