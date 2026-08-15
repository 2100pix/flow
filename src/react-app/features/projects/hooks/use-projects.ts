import { useQuery } from "@tanstack/react-query";

import { getProjects } from "../api/projects";

export const projectsQueryKey = ["projects"] as const;

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: projectsQueryKey,

    queryFn: getProjects,

    enabled,
  });
}
