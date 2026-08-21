import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useMe } from "@/features/auth/hooks/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { useClients } from "@/features/clients/hooks/use-clients";
import { ProjectAccessPicker } from "@/features/projects/components/project-access-picker";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";
import { useArchiveProject } from "@/features/projects/hooks/use-archive-project";
import { useDeleteProject } from "@/features/projects/hooks/use-delete-project";
import { useProject } from "@/features/projects/hooks/use-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";
import { ProjectSettingsTeam } from "@/features/projects/components/project-settings-team";
import type { ProjectDto, ProjectStatus, UpdateProjectInput } from "@/features/projects/types";

import { deriveProjectCode } from "../../../shared/project-code";

const NO_CLIENT_VALUE = "__flow_no_client__";

const PROJECT_SETTINGS_FORM_ID = "project-settings-form";

const statusItems: Array<{
  value: ProjectStatus;
  label: string;
}> = [
  {
    value: "planning",
    label: "Planning",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "on_hold",
    label: "On hold",
  },
  {
    value: "completed",
    label: "Complete",
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ProjectSettingsSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-8 w-48" />

      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>

        <Skeleton className="h-32 w-full" />

        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      <Skeleton className="h-44 w-full" />
    </div>
  );
}

type DangerZoneProps = {
  project: ProjectDto;
  canArchive: boolean;
  canDelete: boolean;
};

function DangerZone({ project, canArchive, canDelete }: DangerZoneProps) {
  const navigate = useNavigate();

  const archiveProject = useArchiveProject();

  const deleteProject = useDeleteProject();

  const [archiveOpen, setArchiveOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  if (!canArchive && !canDelete) {
    return null;
  }

  return (
    <section className="pt-12">
      <h2 className="text-sm font-medium">Dangerzone</h2>

      <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60">
        {canArchive ? (
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Archive project</p>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Archiving this project removes it from normal navigation while retaining its project data.</p>
            </div>

            <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
              <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" className="shrink-0" />}>Archive</AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {project.name}?</AlertDialogTitle>

                  <AlertDialogDescription>The project will be removed from active navigation. Its members, leads, resources, tasks, workflow, and metadata remain stored.</AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={archiveProject.isPending}>Cancel</AlertDialogCancel>

                  <Button
                    type="button"
                    variant="destructive"
                    disabled={archiveProject.isPending}
                    onClick={() => {
                      archiveProject.mutate(project.id, {
                        onSuccess: () => {
                          setArchiveOpen(false);

                          toast.success("Project archived.");

                          void navigate("/projects", {
                            replace: true,
                          });
                        },

                        onError: (error) => {
                          toast.error(getErrorMessage(error, "Failed to archive project."));
                        },
                      });
                    }}
                  >
                    {archiveProject.isPending ? "Archiving…" : "Archive"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}

        {canDelete ? (
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Delete project</p>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Permanently remove this project and all project-owned data. This action cannot be recovered.</p>
            </div>

            <AlertDialog
              open={deleteOpen}
              onOpenChange={(nextOpen) => {
                setDeleteOpen(nextOpen);

                if (!nextOpen) {
                  setDeleteConfirmation("");
                }
              }}
            >
              <AlertDialogTrigger render={<Button type="button" variant="destructive" size="sm" className="shrink-0" />}>Delete</AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete {project.name}?</AlertDialogTitle>

                  <AlertDialogDescription>This permanently removes the project, members, project leads, resources, tasks, workflow, and project metadata. There is no restore.</AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2">
                  <label htmlFor="delete-project-confirmation" className="text-sm font-medium">
                    Type <span className="font-semibold">{project.name}</span> to confirm
                  </label>

                  <input
                    id="delete-project-confirmation"
                    value={deleteConfirmation}
                    autoComplete="off"
                    disabled={deleteProject.isPending}
                    onChange={(event) => {
                      setDeleteConfirmation(event.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>

                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteConfirmation !== project.name || deleteProject.isPending}
                    onClick={() => {
                      deleteProject.mutate(project.id, {
                        onSuccess: () => {
                          setDeleteOpen(false);

                          toast.success("Project deleted.");

                          void navigate("/projects", {
                            replace: true,
                          });
                        },

                        onError: (error) => {
                          toast.error(getErrorMessage(error, "Failed to delete project."));
                        },
                      });
                    }}
                  >
                    {deleteProject.isPending ? "Deleting…" : "Delete permanently"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type ProjectSettingsContentProps = {
  project: ProjectDto;
  canEdit: boolean;
  canManageVisibility: boolean;
  canViewClients: boolean;
  canManageMembers: boolean;
  canViewWorkspaceMembers: boolean;
  canArchive: boolean;
  canDelete: boolean;
};

function ProjectSettingsContent({ project, canEdit, canManageVisibility, canViewClients, canManageMembers, canViewWorkspaceMembers, canArchive, canDelete }: ProjectSettingsContentProps) {
  const canChangeClient = canEdit && canViewClients;

  const { data: clients = [] } = useClients(canChangeClient);

  const [name, setName] = useState(project.name);

  const [projectCodeOverride, setProjectCodeOverride] = useState(project.projectCodeOverride ?? "");

  const [description, setDescription] = useState(project.description ?? "");

  const [clientId, setClientId] = useState(project.client?.id ?? "");

  const [status, setStatus] = useState<ProjectStatus>(project.status);

  const [visibility, setVisibility] = useState<ProjectDto["visibility"]>(project.visibility);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const updateProject = useUpdateProject();

  useEffect(() => {
    const textarea = descriptionRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height = `${Math.max(80, textarea.scrollHeight)}px`;
  }, [description]);

  const availableClients = clients.filter((client) => client.status === "active" || client.id === project.client?.id);

  const clientItems: Array<{
    value: string;
    label: string;
  }> = [
    {
      value: NO_CLIENT_VALUE,
      label: "Select client",
    },

    ...availableClients.map((client) => ({
      value: client.id,
      label: client.status === "inactive" ? `${client.name} (inactive)` : client.name,
    })),
  ];

  if (project.client && !clientItems.some((item) => item.value === project.client?.id)) {
    clientItems.push({
      value: project.client.id,
      label: project.client.name,
    });
  }

  const normalizedName = name.trim();

  const normalizedDescription = description.trim() || null;

  const normalizedCodeOverride = projectCodeOverride.trim() ? projectCodeOverride.trim().toUpperCase() : null;

  const codeValid = normalizedCodeOverride === null || /^[A-Z0-9]{1,4}$/.test(normalizedCodeOverride);
  const clientChanged = canChangeClient && clientId !== (project.client?.id ?? "");

  const visibilityChanged = canManageVisibility && visibility !== project.visibility;

  const metadataDirty = normalizedName !== project.name || normalizedDescription !== project.description || normalizedCodeOverride !== project.projectCodeOverride || clientChanged || status !== project.status || visibilityChanged;

  function submitUpdate() {
    if (!canEdit || !normalizedName || !codeValid || !metadataDirty || updateProject.isPending) {
      return;
    }

    const input: UpdateProjectInput = {};

    if (normalizedName !== project.name) {
      input.name = normalizedName;
    }

    if (normalizedCodeOverride !== project.projectCodeOverride) {
      input.projectCodeOverride = normalizedCodeOverride;
    }

    if (normalizedDescription !== project.description) {
      input.description = normalizedDescription;
    }

    if (clientChanged) {
      input.clientId = clientId || null;
    }

    if (status !== project.status) {
      input.status = status;
    }

    if (visibilityChanged) {
      input.visibility = visibility;
    }

    if (Object.keys(input).length === 0) {
      return;
    }

    updateProject.mutate(
      {
        projectId: project.id,
        input,
      },
      {
        onSuccess: () => {
          toast.success("Project updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update project."));
        },
      },
    );
  }

  return (
    <>
      <form
        id={PROJECT_SETTINGS_FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();

          submitUpdate();
        }}
      >
        <div className="space-y-[30px]">
          <div className="grid gap-[30px] sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-3">
              <label htmlFor="project-settings-name" className="text-sm font-medium">
                Project name
              </label>

              <input
                id="project-settings-name"
                value={name}
                maxLength={160}
                disabled={!canEdit || updateProject.isPending}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />
            </div>

            <div className="space-y-3">
              <label htmlFor="project-settings-code" className="text-sm font-medium">
                Project code
              </label>

              <input
                id="project-settings-code"
                value={projectCodeOverride}
                maxLength={4}
                disabled={!canEdit || updateProject.isPending}
                placeholder={deriveProjectCode(name)}
                onChange={(event) => {
                  setProjectCodeOverride(event.target.value.toUpperCase());
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase shadow-xs outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />

              {!codeValid ? <p className="text-xs text-destructive">Use 1–4 alphanumeric characters.</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="project-settings-description" className="text-sm font-medium">
              Description Project
            </label>

            <textarea
              ref={descriptionRef}
              id="project-settings-description"
              value={description}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              disabled={!canEdit || updateProject.isPending}
              rows={3}
              placeholder="Add a description"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base leading-6 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            />
          </div>

          <div className="grid gap-[30px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)_minmax(180px,0.5fr)]">
            <div className="space-y-3">
              <label className="text-sm font-medium">Client</label>

              {canChangeClient ? (
                <Select
                  items={clientItems}
                  value={clientId || NO_CLIENT_VALUE}
                  disabled={updateProject.isPending}
                  onValueChange={(nextValue) => {
                    setClientId(nextValue === NO_CLIENT_VALUE ? "" : String(nextValue ?? ""));
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-lg px-3 text-sm font-normal shadow-xs">
                    <span className="min-w-0 flex-1 truncate text-left">{clientId ? (clientItems.find((item) => item.value === clientId)?.label ?? "Select client") : "Select client"}</span>
                  </SelectTrigger>

                  <SelectContent align="start" alignItemWithTrigger={false} className="rounded-lg border border-border bg-popover p-1 shadow-md ring-0 before:hidden">
                    <SelectGroup className="p-0">
                      <SelectLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">Clients</SelectLabel>

                      {clientItems.map((item) => (
                        <SelectItem key={item.value} value={item.value} className="h-8 rounded-md py-1.5 pr-8 pl-2 text-sm data-selected:bg-accent">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs">{project.client?.name ?? "Select client"}</div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Project status</label>

              <Select
                items={statusItems}
                value={status}
                disabled={!canEdit || updateProject.isPending}
                onValueChange={(nextValue) => {
                  if (!nextValue) {
                    return;
                  }

                  setStatus(nextValue as ProjectStatus);
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-lg px-3 text-sm font-normal shadow-xs">
                  <span className="min-w-0 flex-1 truncate text-left">{statusItems.find((item) => item.value === status)?.label ?? "Select a status"}</span>
                </SelectTrigger>

                <SelectContent align="start" alignItemWithTrigger={false} className="rounded-lg border border-border bg-popover p-1 shadow-md ring-0 before:hidden">
                  <SelectGroup className="p-0">
                    <SelectLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">Status</SelectLabel>

                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="h-8 rounded-md py-1.5 pr-8 pl-2 text-sm data-selected:bg-accent">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Project access</label>

              <ProjectAccessPicker value={visibility} onValueChange={setVisibility} canChoosePrivate={canManageVisibility} disabled={!canManageVisibility || updateProject.isPending} />
            </div>
          </div>
        </div>
      </form>

      <div className="mt-8">
        <ProjectSettingsTeam project={project} canEdit={canEdit} canManageMembers={canManageMembers} canViewWorkspaceMembers={canViewWorkspaceMembers} />
      </div>

      {canEdit ? (
        <div className="mt-8 flex justify-end">
          <Button type="submit" form={PROJECT_SETTINGS_FORM_ID} disabled={!metadataDirty || !normalizedName || !codeValid || updateProject.isPending}>
            {updateProject.isPending ? "Updating…" : "Update project"}
          </Button>
        </div>
      ) : null}

      <DangerZone project={project} canArchive={canArchive} canDelete={canDelete} />
    </>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams();

  const { data: auth } = useMe();

  const { data: project, isPending, isError } = useProject(projectId);

  if (!projectId) {
    return null;
  }

  const canEdit = hasPermission(auth, "projects.edit");

  const canViewClients = hasPermission(auth, "clients.view");

  const canManagePrivate = hasPermission(auth, "projects.private.manage");

  const canManageVisibility = canEdit && canManagePrivate;

  const canViewWorkspaceMembers = hasPermission(auth, "members.view");

  const canArchive = hasPermission(auth, "projects.archive");

  const canDelete = hasPermission(auth, "projects.delete");

  const canManageMembers = Boolean(project && canEdit && (project.visibility === "workspace" || canManagePrivate));

  return (
    <div className="p-6 md:p-8">
      {isPending ? (
        <>
          <Skeleton className="h-4 w-52" />

          <main className="mx-auto max-w-6xl">
            <div className="mt-10">
              <ProjectSettingsSkeleton />
            </div>
          </main>
        </>
      ) : isError || !project ? (
        <main className="mx-auto max-w-6xl">
          <p className="text-sm text-destructive">Unable to load project.</p>
        </main>
      ) : (
        <>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="min-w-0">
                <span className="max-w-56 truncate text-muted-foreground sm:max-w-80" title={project.name}>
                  {project.name}
                </span>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to={`/projects/${project.id}`} />}>Overview</BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbPage>Project Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <main className="mx-auto max-w-6xl">
            <h1 className="mt-10 text-2xl font-semibold tracking-tight md:text-3xl">Project Settings</h1>

            <div className="mt-8">
              <ProjectSettingsContent
                key={`${project.id}:${project.updatedAt}`}
                project={project}
                canEdit={canEdit}
                canManageVisibility={canManageVisibility}
                canViewClients={canViewClients}
                canManageMembers={canManageMembers}
                canViewWorkspaceMembers={canViewWorkspaceMembers}
                canArchive={canArchive}
                canDelete={canDelete}
              />
            </div>
          </main>
        </>
      )}
    </div>
  );
}
