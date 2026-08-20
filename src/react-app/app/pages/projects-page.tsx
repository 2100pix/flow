import { PlusIcon } from "@phosphor-icons/react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { hasPermission } from "@/features/auth/permissions";

export function ProjectsPage() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const { data: auth } = useMe();
  const canView = hasPermission(auth, "projects.view");
  const canCreate = hasPermission(auth, "projects.create");
  const canCreatePrivate = hasPermission(auth, "projects.private.create");
  const canViewClients = hasPermission(auth, "clients.view");
  const { data: projects = [], isPending, isError } = useProjects(canView);

  const createOpen = searchParams.get("create") === "project";
  if (auth && !canView) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You do not have access to projects.</p>
      </div>
    );
  }
  function openCreate() {
    const next = new URLSearchParams(searchParams);

    next.set("create", "project");

    setSearchParams(next);
  }

  function closeCreate() {
    const next = new URLSearchParams(searchParams);

    next.delete("create");

    setSearchParams(next, {
      replace: true,
    });
  }

  function handleProjectCreated(projectId: string) {
    void navigate(`/projects/${projectId}`, {
      replace: true,
    });
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Projects</h1>

            <p className="mt-1 text-sm text-muted-foreground">Active work across workspace clients.</p>
          </div>
          {canCreate ? (
            <Button type="button" onClick={openCreate}>
              <PlusIcon />
              New project
            </Button>
          ) : null}
        </div>

        {isPending && <p className="text-sm text-muted-foreground">Loading projects…</p>}

        {isError && <p className="text-sm text-destructive">Unable to load projects.</p>}

        {!isPending && !isError && projects.length === 0 && (
          <div className="rounded-lg border border-dashed p-8">
            <p className="text-sm font-medium">No projects yet</p>

            <p className="mt-1 text-sm text-muted-foreground">Projects added to Flow will appear here.</p>
          </div>
        )}

        {projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="group flex min-h-48 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.name}</p>

                    <p className="mt-1 truncate text-xs text-muted-foreground">{project.client?.name ?? "Not set"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {project.visibility === "private" ? <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium text-foreground">Private</span> : null}

                    <span className="rounded-full border border-border px-2 py-1 text-[10px] capitalize text-muted-foreground">{project.status.replace("_", " ")}</span>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{project.description || "No description"}</p>

                <div className="mt-auto flex items-center justify-between gap-4 pt-5 text-xs text-muted-foreground">
                  <span>{project.dueDate ? `Due ${project.dueDate}` : "No due date"}</span>

                  <span className="transition-colors group-hover:text-foreground">Open</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {canCreate && auth ? <CreateProjectDialog open={createOpen} onClose={closeCreate} onCreated={handleProjectCreated} canCreatePrivate={canCreatePrivate} canViewClients={canViewClients} /> : null}{" "}
    </div>
  );
}
