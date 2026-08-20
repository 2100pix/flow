import { useEffect, useRef, useState } from "react";
import { CrownIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useMe } from "@/features/auth/hooks/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useAddProjectMember } from "@/features/members/hooks/use-add-project-member";
import { useMembers } from "@/features/members/hooks/use-members";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useRemoveProjectMember } from "@/features/members/hooks/use-remove-project-member";
import type { ProjectMemberDto } from "@/features/members/types";
import { ProjectAccessPicker } from "@/features/projects/components/project-access-picker";
import { PROJECT_DESCRIPTION_MAX_LENGTH, PROJECT_LEAD_MAX_COUNT } from "@/features/projects/constants";
import { useArchiveProject } from "@/features/projects/hooks/use-archive-project";
import { useDeleteProject } from "@/features/projects/hooks/use-delete-project";
import { useProject } from "@/features/projects/hooks/use-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";
import { useUpdateProjectLeads } from "@/features/projects/hooks/use-update-project-leads";
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

function getMemberInitials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function getMemberRoleLabel(member: ProjectMemberDto) {
  if (member.user.customRole) {
    return member.user.customRole.name;
  }

  switch (member.user.role) {
    case "owner":
      return "Owner";

    case "admin":
      return "Admin";

    default:
      return "Member";
  }
}

function ProjectSettingsSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-4 w-52" />

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

type TeamMembersSectionProps = {
  project: ProjectDto;
  canEdit: boolean;
  canManageMembers: boolean;
  canViewWorkspaceMembers: boolean;
};

function TeamMembersSection({ project, canEdit, canManageMembers, canViewWorkspaceMembers }: TeamMembersSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const [expanded, setExpanded] = useState(false);

  const { data: projectMembers = [], isPending: membersPending, isError: membersError } = useProjectMembers(project.id);

  const { data: workspaceMembers = [], isPending: workspaceMembersPending, isError: workspaceMembersError } = useMembers(inviteOpen && canManageMembers && canViewWorkspaceMembers);

  const addMember = useAddProjectMember();

  const removeMember = useRemoveProjectMember();

  const updateLeads = useUpdateProjectLeads();

  const orderedMembers = [...projectMembers].sort((first, second) => {
    const dateOrder = first.addedAt.localeCompare(second.addedAt);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return first.user.id.localeCompare(second.user.id);
  });

  const leads = orderedMembers.filter((member) => member.isLead).sort((first, second) => (first.leadPosition ?? 99) - (second.leadPosition ?? 99));

  const leadIds = leads.map((lead) => lead.user.id);

  const assignedIds = new Set(orderedMembers.map((member) => member.user.id));

  const availableWorkspaceMembers = workspaceMembers.filter((member) => !assignedIds.has(member.id));

  const visibleMembers = expanded ? orderedMembers : orderedMembers.slice(0, 5);

  const hiddenMemberCount = Math.max(orderedMembers.length - 5, 0);

  const teamMutationPending = addMember.isPending || removeMember.isPending || updateLeads.isPending;

  function addProjectMember(userId: string) {
    if (!canManageMembers || teamMutationPending) {
      return;
    }

    addMember.mutate(
      {
        projectId: project.id,
        userId,
      },
      {
        onSuccess: () => {
          toast.success("Project member added.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to add project member."));
        },
      },
    );
  }

  function addLead(userId: string) {
    if (!canEdit || leadIds.includes(userId) || leadIds.length >= PROJECT_LEAD_MAX_COUNT || teamMutationPending) {
      return;
    }

    updateLeads.mutate(
      {
        projectId: project.id,
        userIds: [...leadIds, userId],
      },
      {
        onSuccess: () => {
          toast.success("Project lead added.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to add project lead."));
        },
      },
    );
  }

  function removeLead(userId: string) {
    if (!canEdit || leadIds.length <= 1 || teamMutationPending) {
      return;
    }

    updateLeads.mutate(
      {
        projectId: project.id,

        userIds: leadIds.filter((leadId) => leadId !== userId),
      },
      {
        onSuccess: () => {
          toast.success("Project lead removed.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to remove project lead."));
        },
      },
    );
  }

  function removeProjectMember(member: ProjectMemberDto) {
    if (!canManageMembers || teamMutationPending) {
      return;
    }

    if (member.isLead && leadIds.length <= 1) {
      return;
    }

    removeMember.mutate(
      {
        projectId: project.id,
        userId: member.user.id,
      },
      {
        onSuccess: () => {
          toast.success("Project member removed.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to remove project member."));
        },
      },
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Team members</h2>

          <p className="mt-1 text-xs text-muted-foreground">Members assigned to this project and its project leads.</p>
        </div>

        {canManageMembers && canViewWorkspaceMembers ? (
          <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
            <PopoverTrigger render={<Button type="button" variant="outline" size="icon-sm" aria-label="Invite project member" />}>
              <PlusIcon aria-hidden="true" />
            </PopoverTrigger>

            <PopoverContent align="end" className="w-72 p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Invite Members</p>

              {workspaceMembersPending ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">Loading workspace members…</p>
              ) : workspaceMembersError ? (
                <p className="px-2 py-3 text-xs text-destructive">Unable to load workspace members.</p>
              ) : availableWorkspaceMembers.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">All workspace members are already assigned.</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {availableWorkspaceMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={teamMutationPending}
                      onClick={() => {
                        addProjectMember(member.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Avatar size="sm" aria-hidden="true">
                        {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}

                        <AvatarFallback>{getMemberInitials(member.displayName)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate">{member.displayName}</p>

                        <p className="truncate text-xs capitalize text-muted-foreground">{member.customRole?.name ?? member.role}</p>
                      </div>

                      <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      <div className="mt-5">
        {membersPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : membersError ? (
          <p className="text-sm text-destructive">Unable to load project members.</p>
        ) : orderedMembers.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium">Invite your team to collaborate on this project.</p>

            <p className="mt-1 text-xs text-muted-foreground">Project members will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 border-y border-border/60">
            {visibleMembers.map((member) => {
              const soleLead = member.isLead && leadIds.length === 1;

              return (
                <div key={member.user.id} className="flex min-w-0 items-center gap-3 py-3">
                  <Avatar size="default" aria-hidden="true">
                    {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                    <AvatarFallback>{getMemberInitials(member.user.displayName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium">{member.user.displayName}</p>

                      {member.isLead ? (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Lead
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{getMemberRoleLabel(member)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && !member.isLead && leadIds.length < PROJECT_LEAD_MAX_COUNT ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={teamMutationPending}
                        onClick={() => {
                          addLead(member.user.id);
                        }}
                      >
                        <CrownIcon aria-hidden="true" />
                        Set Lead
                      </Button>
                    ) : null}

                    {canEdit && member.isLead && leadIds.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={teamMutationPending}
                        onClick={() => {
                          removeLead(member.user.id);
                        }}
                      >
                        Remove Lead
                      </Button>
                    ) : null}

                    {canManageMembers ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.user.displayName} from project`}
                        title={soleLead ? "Assign another project lead before removing this member" : `Remove ${member.user.displayName}`}
                        disabled={teamMutationPending || soleLead}
                        onClick={() => {
                          removeProjectMember(member);
                        }}
                      >
                        <TrashIcon aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!expanded && hiddenMemberCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setExpanded(true);
            }}
          >
            View more
            <span className="text-muted-foreground">+{hiddenMemberCount}</span>
          </Button>
        ) : null}

        {expanded && hiddenMemberCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setExpanded(false);
            }}
          >
            Show less
          </Button>
        ) : null}
      </div>
    </section>
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

    textarea.style.height = `${Math.max(112, textarea.scrollHeight)}px`;
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

  const codeValid = normalizedCodeOverride === null || /^[A-Z0-9]{1,8}$/.test(normalizedCodeOverride);

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
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-1.5">
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
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-settings-code" className="text-sm font-medium">
                Project code
              </label>

              <input
                id="project-settings-code"
                value={projectCodeOverride}
                maxLength={8}
                disabled={!canEdit || updateProject.isPending}
                placeholder={deriveProjectCode(name)}
                onChange={(event) => {
                  setProjectCodeOverride(event.target.value.toUpperCase());
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />

              {!codeValid ? <p className="text-xs text-destructive">Use 1–8 alphanumeric characters.</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-settings-description" className="text-sm font-medium">
              Description
            </label>

            <textarea
              ref={descriptionRef}
              id="project-settings-description"
              value={description}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              disabled={!canEdit || updateProject.isPending}
              rows={4}
              placeholder="Add a description"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="min-h-28 w-full resize-none overflow-hidden rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>

                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {clientItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground">{project.client?.name ?? "Select client"}</div>
              )}
            </div>

            <div className="space-y-1.5">
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>

                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project access</label>

              <div className="[&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-between">
                <ProjectAccessPicker value={visibility} onValueChange={setVisibility} canChoosePrivate={canManageVisibility} disabled={!canManageVisibility || updateProject.isPending} />
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="mt-12">
        <TeamMembersSection project={project} canEdit={canEdit} canManageMembers={canManageMembers} canViewWorkspaceMembers={canViewWorkspaceMembers} />
      </div>

      {canEdit ? (
        <div className="mt-6 flex justify-end">
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
      <main className="mx-auto max-w-4xl">
        {isPending ? (
          <ProjectSettingsSkeleton />
        ) : isError || !project ? (
          <p className="text-sm text-destructive">Unable to load project.</p>
        ) : (
          <>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link to="/projects" />}>Project</BreadcrumbLink>
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

            <h1 className="mt-8 text-2xl font-semibold tracking-tight">Project Settings</h1>

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
          </>
        )}
      </main>
    </div>
  );
}
