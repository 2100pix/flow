import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AuthContext } from "@/features/auth/types";
import { meQueryKey } from "@/features/auth/hooks/use-me";

import { updateWorkspace } from "../api/workspace";

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkspace,

    onSuccess: (workspace) => {
      queryClient.setQueryData<AuthContext | null>(meQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          workspace: {
            ...current.workspace,
            name: workspace.name,
          },
        };
      });
    },
  });
}
