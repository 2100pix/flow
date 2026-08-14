import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { Link } from "react-router";

export function ProjectsPage() {
  const [name, setName] = useState("");

  const [clientId, setClientId] = useState("");

  const { data: auth } = useMe();

  const { data: clients = [] } = useClients();

  const { data: projects = [], isPending, isError } = useProjects();

  const createProject = useCreateProject();

  const activeClients = clients.filter((client) => client.status === "active");

  const canCreate = auth?.workspace.role === "owner" || auth?.workspace.role === "admin";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>

          <p className="text-sm text-muted-foreground">Active work across INVS clients.</p>
        </div>

        {canCreate ? (
          <div className="rounded-lg border p-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                const projectName = name.trim();

                if (!projectName || !clientId) {
                  return;
                }

                createProject.mutate(
                  {
                    name: projectName,

                    clientId,
                  },
                  {
                    onSuccess: () => {
                      setName("");
                      setClientId("");
                    },
                  },
                );
              }}
            >
              <div className="space-y-1.5">
                <label htmlFor="project-name" className="block text-sm font-medium">
                  Project
                </label>

                <input
                  id="project-name"
                  value={name}
                  maxLength={160}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  placeholder="Project name"
                  className="h-8 w-64 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="project-client" className="block text-sm font-medium">
                  Client
                </label>

                <select
                  id="project-client"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                  }}
                  className="h-8 w-56 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                >
                  <option value="">Select client</option>

                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={!name.trim() || !clientId || createProject.isPending}>
                {createProject.isPending ? "Adding…" : "Add project"}
              </Button>
            </form>

            {activeClients.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">An active client is required before creating a project.</p> : null}

            {createProject.isError ? <p className="mt-3 text-sm text-destructive">{createProject.error.message}</p> : null}
          </div>
        ) : null}

        {isPending ? <p className="text-sm text-muted-foreground">Loading projects…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load projects.</p> : null}

        {!isPending && !isError && projects.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8">
            <p className="text-sm font-medium">No projects yet</p>

            <p className="mt-1 text-sm text-muted-foreground">Projects added to Flow will appear here.</p>
          </div>
        ) : null}

        {projects.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-6 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>

                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.client.name}</p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{project.status.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
