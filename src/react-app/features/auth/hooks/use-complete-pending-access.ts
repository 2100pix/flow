import { useMutation } from "@tanstack/react-query";

import { completePendingAccess } from "../api/auth";

export function useCompletePendingAccess() {
  return useMutation({
    mutationFn: completePendingAccess,
  });
}
