import { useQuery } from "@tanstack/react-query";

import { getProjectMembers } from "../api/members";

export function projectMembersQueryKey(projectId: string) {
  return ["projects", projectId, "members"] as const;
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectMembersQueryKey(projectId),

    queryFn: () => getProjectMembers(projectId),
  });
}
