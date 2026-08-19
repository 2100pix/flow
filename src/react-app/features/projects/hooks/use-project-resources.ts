import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProjectResource, deleteProjectResource, getProjectResources, updateProjectResource } from "../api/project-resources";

import type { CreateProjectResourceInput, UpdateProjectResourceInput } from "../types";

export function projectResourcesQueryKey(projectId: string) {
  return ["projects", projectId, "resources"] as const;
}

export function useProjectResources(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectResourcesQueryKey(projectId),

    queryFn: () => getProjectResources(projectId),

    enabled,
  });
}

type CreateVariables = {
  projectId: string;
  input: CreateProjectResourceInput;
};

export function useCreateProjectResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: CreateVariables) => createProjectResource(projectId, input),

    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectResourcesQueryKey(variables.projectId),
      });
    },
  });
}

type UpdateVariables = {
  projectId: string;
  resourceId: string;
  input: UpdateProjectResourceInput;
};

export function useUpdateProjectResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, resourceId, input }: UpdateVariables) => updateProjectResource(projectId, resourceId, input),

    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectResourcesQueryKey(variables.projectId),
      });
    },
  });
}

type DeleteVariables = {
  projectId: string;
  resourceId: string;
};

export function useDeleteProjectResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, resourceId }: DeleteVariables) => deleteProjectResource(projectId, resourceId),

    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectResourcesQueryKey(variables.projectId),
      });
    },
  });
}
