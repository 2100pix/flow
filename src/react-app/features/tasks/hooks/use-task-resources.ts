import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTaskResource, deleteTaskResource, getTaskResources, updateTaskResource } from "../api/task-resources";

import type { CreateTaskResourceInput, UpdateTaskResourceInput } from "../types";

export function taskResourcesQueryKey(taskId: string) {
  return ["tasks", taskId, "resources"] as const;
}

export function useTaskResources(taskId: string, enabled = true) {
  return useQuery({
    queryKey: taskResourcesQueryKey(taskId),

    queryFn: () => getTaskResources(taskId),

    enabled,
  });
}

type CreateVariables = {
  taskId: string;

  input: CreateTaskResourceInput;
};

export function useCreateTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, input }: CreateVariables) => createTaskResource(taskId, input),

    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({
        queryKey: taskResourcesQueryKey(variables.taskId),
      });
    },
  });
}

type UpdateVariables = {
  taskId: string;
  resourceId: string;

  input: UpdateTaskResourceInput;
};

export function useUpdateTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, resourceId, input }: UpdateVariables) => updateTaskResource(taskId, resourceId, input),

    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({
        queryKey: taskResourcesQueryKey(variables.taskId),
      });
    },
  });
}

type DeleteVariables = {
  taskId: string;
  resourceId: string;
};

export function useDeleteTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, resourceId }: DeleteVariables) => deleteTaskResource(taskId, resourceId),

    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: taskResourcesQueryKey(variables.taskId),
      });
    },
  });
}
