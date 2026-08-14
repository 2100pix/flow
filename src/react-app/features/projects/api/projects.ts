import { apiFetch } from "@/lib/api";

import type { CreateProjectInput, ProjectResponse, ProjectsResponse } from "../types";

export async function getProjects() {
  const response = await apiFetch<ProjectsResponse>("/api/projects");

  return response.data;
}

export async function createProject(input: CreateProjectInput) {
  const response = await apiFetch<ProjectResponse>("/api/projects", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}
