import { useMutation } from "@tanstack/react-query";

import { continuePendingAccess } from "../api/auth";

export function useContinuePendingAccess() {
  return useMutation({
    mutationFn: continuePendingAccess,
  });
}
