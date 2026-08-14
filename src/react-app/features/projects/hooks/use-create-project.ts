import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createProject } from "../api/projects";
import { projectsQueryKey } from "./use-projects";

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectsQueryKey,
      });
    },
  });
}
