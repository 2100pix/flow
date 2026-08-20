import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKey } from "@/features/dashboard/hooks/use-dashboard";

import { updateProject } from "../api/projects";
import type { UpdateProjectInput } from "../types";
import { projectQueryKey } from "./use-project";
import { projectsQueryKey } from "./use-projects";

type UpdateProjectVariables = {
  projectId: string;
  input: UpdateProjectInput;
};

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: UpdateProjectVariables) => updateProject(projectId, input),

    onSuccess: async (project) => {
      queryClient.setQueryData(projectQueryKey(project.id), project);

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
