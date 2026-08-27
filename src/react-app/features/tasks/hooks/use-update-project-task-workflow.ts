import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProjectTaskWorkflow } from "../api/tasks";
import type { UpdateTaskWorkflowInput } from "../types";
import { projectTaskWorkflowQueryKey } from "./use-project-task-workflow";

type UpdateProjectTaskWorkflowVariables = {
  projectId: string;
  input: UpdateTaskWorkflowInput;
};

export function useUpdateProjectTaskWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, input }: UpdateProjectTaskWorkflowVariables) => updateProjectTaskWorkflow(projectId, input),

    onSuccess: async (workflow) => {
      queryClient.setQueryData(projectTaskWorkflowQueryKey(workflow.projectId), workflow);

      await queryClient.invalidateQueries({
        queryKey: projectTaskWorkflowQueryKey(workflow.projectId),
      });
    },
  });
}
