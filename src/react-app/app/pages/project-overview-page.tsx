import { useEffect, useRef, useState } from "react";

import { ArrowSquareOutIcon, CalendarBlankIcon, CaretDownIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useParams } from "react-router";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import { useMe } from "@/features/auth/hooks/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useAddProjectMember } from "@/features/members/hooks/use-add-project-member";
import { useMembers } from "@/features/members/hooks/use-members";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useRemoveProjectMember } from "@/features/members/hooks/use-remove-project-member";
import type { ProjectMemberDto } from "@/features/members/types";
import { KeyResourcesSection } from "@/features/projects/components/key-resources-section";
import { PROJECT_DESCRIPTION_MAX_LENGTH, PROJECT_LEAD_MAX_COUNT } from "@/features/projects/constants";
import { useProject } from "@/features/projects/hooks/use-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";
import { useUpdateProjectLeads } from "@/features/projects/hooks/use-update-project-leads";
import { type ProjectDto, type ProjectStatus } from "@/features/projects/types";

const statusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

const engagementLabels: Record<ProjectDto["engagementType"], string> = {
  project: "Project",
  retainer: "Retainer",
};

const DESCRIPTION_PLACEHOLDER = "What are we building, and what does success look like?";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseProjectDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function serializeProjectDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatProjectDate(value: string | null) {
  const date = parseProjectDate(value);

  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMemberInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getProjectMemberRoleLabel(member: ProjectMemberDto) {
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

function OverviewSkeleton() {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-4 w-32" />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-20">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-12 rounded-md" />
            </div>

            <Skeleton className="mt-4 h-4 w-full max-w-xl" />
            <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />

            <div className="mt-12">
              <Skeleton className="h-5 w-28" />

              <div className="mt-5 grid gap-8 sm:grid-cols-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>

              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        <div className="mt-16 max-w-2xl">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-4 w-64" />
          <Skeleton className="mt-5 h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ProjectIdentityEditor({ projectId, name, description, projectCode, statusLabel, canEdit }: { projectId: string; name: string; description: string | null; projectCode: string; statusLabel: string; canEdit: boolean }) {
  const updateProject = useUpdateProject();

  const [editingName, setEditingName] = useState(false);

  const [editingDescription, setEditingDescription] = useState(false);

  const [nextName, setNextName] = useState(name);

  const [nextDescription, setNextDescription] = useState(description ?? "");

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const skipNameBlurRef = useRef(false);

  const skipDescriptionBlurRef = useRef(false);

  useEffect(() => {
    if (!editingDescription) {
      return;
    }

    const textarea = descriptionRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editingDescription, nextDescription]);

  function saveName() {
    if (skipNameBlurRef.current) {
      skipNameBlurRef.current = false;
      return;
    }

    const value = nextName.trim();

    if (!value) {
      setNextName(name);
      setEditingName(false);
      return;
    }

    if (value === name) {
      setEditingName(false);
      return;
    }

    updateProject.mutate(
      {
        projectId,
        input: {
          name: value,
        },
      },
      {
        onSuccess: () => {
          setEditingName(false);
          toast.success("Project name updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update project name."));
        },
      },
    );
  }

  function saveDescription() {
    if (skipDescriptionBlurRef.current) {
      skipDescriptionBlurRef.current = false;

      return;
    }

    const value = nextDescription.trim();

    if (value === (description ?? "")) {
      setEditingDescription(false);
      return;
    }

    updateProject.mutate(
      {
        projectId,
        input: {
          description: value || null,
        },
      },
      {
        onSuccess: () => {
          setEditingDescription(false);

          toast.success("Description updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update description."));
        },
      },
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        {editingName && canEdit ? (
          <span className="relative inline-grid min-w-0 max-w-2xl align-middle">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre text-2xl font-semibold tracking-tight md:text-3xl">
              {nextName || " "}
            </span>

            <input
              autoFocus
              value={nextName}
              maxLength={160}
              disabled={updateProject.isPending}
              aria-label="Project name"
              onChange={(event) => {
                setNextName(event.target.value);
              }}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();

                  event.currentTarget.blur();
                }

                if (event.key === "Escape") {
                  event.preventDefault();

                  skipNameBlurRef.current = true;

                  setNextName(name);
                  setEditingName(false);
                }
              }}
              className="absolute inset-0 h-full w-full min-w-0 border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none md:text-3xl"
            />
          </span>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => {
              setNextName(name);
              setEditingName(true);
            }}
            className="min-w-0 cursor-text break-words rounded-sm text-left text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-3xl"
          >
            {name}
          </button>
        ) : (
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
        )}

        <Badge variant="outline" className="font-mono text-[11px] tracking-wide text-muted-foreground">
          {projectCode}
        </Badge>

        <Badge variant="outline" className="lg:hidden" aria-label={`Project status: ${statusLabel}`}>
          {statusLabel}
        </Badge>
      </div>

      {editingDescription && canEdit ? (
        <textarea
          ref={descriptionRef}
          autoFocus
          value={nextDescription}
          maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
          rows={1}
          disabled={updateProject.isPending}
          aria-label="Project description"
          placeholder={DESCRIPTION_PLACEHOLDER}
          onChange={(event) => {
            setNextDescription(event.target.value);
          }}
          onBlur={saveDescription}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();

              skipDescriptionBlurRef.current = true;

              setNextDescription(description ?? "");

              setEditingDescription(false);
            }

            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();

              event.currentTarget.blur();
            }
          }}
          className="mt-4 min-h-6 w-full max-w-2xl resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => {
            setNextDescription(description ?? "");

            setEditingDescription(true);
          }}
          className="mt-4 block max-w-2xl cursor-text rounded-sm text-left text-sm leading-6 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {description || <span className="text-muted-foreground/50">{DESCRIPTION_PLACEHOLDER}</span>}
        </button>
      ) : (
        <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{description || <span className="text-muted-foreground/50">{DESCRIPTION_PLACEHOLDER}</span>}</p>
      )}
    </div>
  );
}

function StartDateField({ projectId, value, canEdit }: { projectId: string; value: string | null; canEdit: boolean }) {
  const updateProject = useUpdateProject();

  const [open, setOpen] = useState(false);

  const selected = parseProjectDate(value);

  function updateDate(nextDate: string | null) {
    if (nextDate === value) {
      setOpen(false);
      return;
    }

    updateProject.mutate(
      {
        projectId,
        input: {
          startDate: nextDate,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);

          toast.success("Start date updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update start date."));
        },
      },
    );
  }

  if (!canEdit) {
    return <p className="mt-2 text-sm">{formatProjectDate(value)}</p>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="ghost" disabled={updateProject.isPending} className="-ml-2 mt-1 h-8 justify-start px-2 font-normal" />}>
        <CalendarBlankIcon aria-hidden="true" />

        {formatProjectDate(value)}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            updateDate(serializeProjectDate(date));
          }}
        />

        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={value === null || updateProject.isPending}
            onClick={() => {
              updateDate(null);
            }}
          >
            Clear start date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DueDateField({ projectId, dueDate, dueDateMode, canEdit }: { projectId: string; dueDate: string | null; dueDateMode: ProjectDto["dueDateMode"]; canEdit: boolean }) {
  const updateProject = useUpdateProject();

  const [open, setOpen] = useState(false);

  const selected = dueDateMode === "date" ? parseProjectDate(dueDate) : undefined;

  const label = dueDateMode === "ongoing" ? "Ongoing" : dueDateMode === "date" ? formatProjectDate(dueDate) : "Not set";

  function updateDueDate(nextDueDate: string | null, nextMode: ProjectDto["dueDateMode"]) {
    if (nextDueDate === dueDate && nextMode === dueDateMode) {
      setOpen(false);
      return;
    }

    updateProject.mutate(
      {
        projectId,
        input: {
          dueDate: nextDueDate,
          dueDateMode: nextMode,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);

          toast.success("Due date updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update due date."));
        },
      },
    );
  }

  if (!canEdit) {
    return <p className="mt-2 text-sm">{label}</p>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="ghost" disabled={updateProject.isPending} className="-ml-2 mt-1 h-8 justify-start px-2 font-normal" />}>
        <CalendarBlankIcon aria-hidden="true" />

        {label}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            updateDueDate(serializeProjectDate(date), "date");
          }}
        />

        <div className="space-y-1 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={updateProject.isPending}
            onClick={() => {
              updateDueDate(null, "ongoing");
            }}
          >
            Ongoing
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={dueDateMode === "unset" || updateProject.isPending}
            onClick={() => {
              updateDueDate(null, "unset");
            }}
          >
            Clear due date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ClientField({ project, canEdit, canViewClients }: { project: ProjectDto; canEdit: boolean; canViewClients: boolean }) {
  const updateProject = useUpdateProject();

  const { data: clients = [], isPending, isError } = useClients(canEdit && canViewClients);

  if (!canEdit || !canViewClients) {
    return <p className="mt-2 break-words text-sm">{project.client.name}</p>;
  }

  if (isError) {
    return (
      <div className="mt-2">
        <p className="text-sm">{project.client.name}</p>

        <p className="mt-1 text-xs text-destructive">Unable to load clients.</p>
      </div>
    );
  }

  const availableClients = clients.filter((client) => client.status === "active" || client.id === project.client.id);

  return (
    <div className="group/client relative -ml-2 mt-1 inline-flex max-w-full items-center">
      <select
        aria-label="Project client"
        value={project.client.id}
        disabled={isPending || updateProject.isPending}
        onChange={(event) => {
          const clientId = event.target.value;

          if (clientId === project.client.id) {
            return;
          }

          updateProject.mutate(
            {
              projectId: project.id,
              input: {
                clientId,
              },
            },
            {
              onSuccess: () => {
                toast.success("Client updated.");
              },

              onError: (error) => {
                toast.error(getErrorMessage(error, "Failed to update client."));
              },
            },
          );
        }}
        className="h-8 max-w-full cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent py-0 pl-2 pr-7 text-sm outline-none hover:bg-muted focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
      >
        {availableClients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
            {client.status === "inactive" ? " (inactive)" : ""}
          </option>
        ))}
      </select>

      <CaretDownIcon aria-hidden="true" className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/client:opacity-100 group-focus-within/client:opacity-100" />
    </div>
  );
}

function EngagementField({ project, canEdit }: { project: ProjectDto; canEdit: boolean }) {
  const updateProject = useUpdateProject();

  if (!canEdit) {
    return <p className="mt-2 text-sm">{engagementLabels[project.engagementType]}</p>;
  }

  return (
    <div className="group/engagement relative -ml-2 mt-1 inline-flex items-center">
      <select
        aria-label="Project engagement"
        value={project.engagementType}
        disabled={updateProject.isPending}
        onChange={(event) => {
          const engagementType = event.target.value as ProjectDto["engagementType"];

          if (engagementType === project.engagementType) {
            return;
          }

          updateProject.mutate(
            {
              projectId: project.id,
              input: {
                engagementType,
              },
            },
            {
              onSuccess: () => {
                toast.success("Engagement updated.");
              },

              onError: (error) => {
                toast.error(getErrorMessage(error, "Failed to update engagement."));
              },
            },
          );
        }}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent py-0 pl-2 pr-7 text-sm outline-none hover:bg-muted focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
      >
        <option value="project">Project</option>

        <option value="retainer">Retainer</option>
      </select>

      <CaretDownIcon aria-hidden="true" className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/engagement:opacity-100 group-focus-within/engagement:opacity-100" />
    </div>
  );
}
function CollaborationControls({
  project,
  projectMembers,
  membersPending,
  membersError,
  canEdit,
  canManageMembers,
  canViewWorkspaceMembers,
}: {
  project: ProjectDto;
  projectMembers: ProjectMemberDto[];
  membersPending: boolean;
  membersError: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canViewWorkspaceMembers: boolean;
}) {
  const updateLeads = useUpdateProjectLeads();

  const addMember = useAddProjectMember();

  const removeMember = useRemoveProjectMember();

  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const [memberToAdd, setMemberToAdd] = useState("");

  const { data: workspaceMembers = [], isPending: workspaceMembersPending, isError: workspaceMembersError } = useMembers(membersDialogOpen && canManageMembers && canViewWorkspaceMembers);
  const orderedMembers = [...projectMembers].sort((first, second) => {
    const addedAtOrder = first.addedAt.localeCompare(second.addedAt);

    if (addedAtOrder !== 0) {
      return addedAtOrder;
    }

    return first.user.id.localeCompare(second.user.id);
  });
  const leads = projectMembers.filter((member) => member.isLead).sort((first, second) => (first.leadPosition ?? 99) - (second.leadPosition ?? 99));

  const leadIds = leads.map((member) => member.user.id);

  const leadCandidates = orderedMembers.filter((member) => !member.isLead);

  const visibleMembers = orderedMembers.slice(0, 5);

  const remainingMembers = Math.max(orderedMembers.length - visibleMembers.length, 0);

  const assignedIds = new Set(orderedMembers.map((member) => member.user.id));
  const availableWorkspaceMembers = workspaceMembers.filter((member) => !assignedIds.has(member.id));

  const collaborationPending = updateLeads.isPending || addMember.isPending || removeMember.isPending;

  function addLead(userId: string) {
    if (leadIds.includes(userId) || leadIds.length >= PROJECT_LEAD_MAX_COUNT) {
      return;
    }

    updateLeads.mutate(
      {
        projectId: project.id,
        userIds: [...leadIds, userId],
      },
      {
        onSuccess: () => {
          setLeadPickerOpen(false);

          toast.success("Project lead added.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to add project lead."));
        },
      },
    );
  }

  function removeLead(userId: string) {
    if (leadIds.length <= 1) {
      return;
    }

    const nextLeadIds = leadIds.filter((leadId) => leadId !== userId);

    updateLeads.mutate(
      {
        projectId: project.id,
        userIds: nextLeadIds,
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

  function handleAddMember() {
    if (!memberToAdd) {
      return;
    }

    addMember.mutate(
      {
        projectId: project.id,
        userId: memberToAdd,
      },
      {
        onSuccess: () => {
          setMemberToAdd("");

          toast.success("Project member added.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to add project member."));
        },
      },
    );
  }

  function handleRemoveMember(member: ProjectMemberDto) {
    if (member.isLead && leads.length === 1) {
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
    <div className="lg:relative">
      <div className="hidden lg:absolute lg:left-0 lg:top-0 lg:block">
        <Badge variant="outline" aria-label={`Project status: ${statusLabels[project.status]}`}>
          {statusLabels[project.status]}
        </Badge>
      </div>

      <div className="space-y-8 lg:pt-12">
        <div className="group/leads">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Project Leads</p>

            {canEdit && !membersPending && !membersError && leads.length < PROJECT_LEAD_MAX_COUNT && leadCandidates.length > 0 ? (
              <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Add project lead"
                      disabled={updateLeads.isPending}
                      className="pointer-events-none opacity-0 transition-opacity group-hover/leads:pointer-events-auto group-hover/leads:opacity-100 group-focus-within/leads:pointer-events-auto group-focus-within/leads:opacity-100"
                    />
                  }
                >
                  <PlusIcon aria-hidden="true" />
                </PopoverTrigger>

                <PopoverContent align="start" className="w-64 p-2">
                  <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Add project lead</p>

                  <div className="space-y-1">
                    {leadCandidates.map((member) => (
                      <button
                        key={member.user.id}
                        type="button"
                        disabled={updateLeads.isPending}
                        onClick={() => {
                          addLead(member.user.id);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Avatar size="sm" aria-hidden="true">
                          {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                          <AvatarFallback>{getMemberInitials(member.user.displayName)}</AvatarFallback>
                        </Avatar>

                        <span className="min-w-0 truncate">{member.user.displayName}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          <div className="mt-2">
            {membersPending ? (
              <Skeleton className="h-8 w-32" />
            ) : membersError ? (
              <p className="text-sm text-muted-foreground">Unable to load leads</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-destructive">Lead required</p>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => (
                  <div key={lead.user.id} className="group/lead flex min-w-0 items-center gap-2">
                    <Avatar size="sm" role="img" aria-label={lead.user.displayName} title={lead.user.displayName}>
                      {lead.user.avatarUrl ? <AvatarImage src={lead.user.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{getMemberInitials(lead.user.displayName)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{lead.user.displayName}</span>
                    {canEdit && leads.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="pointer-events-none opacity-0 transition-opacity group-hover/lead:pointer-events-auto group-hover/lead:opacity-100 group-focus-within/lead:pointer-events-auto group-focus-within/lead:opacity-100"
                        aria-label={`Remove ${lead.user.displayName} as project lead`}
                        disabled={updateLeads.isPending}
                        onClick={() => {
                          removeLead(lead.user.id);
                        }}
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Members</p>

          <div className="mt-2">
            {membersPending ? (
              <Skeleton className="h-8 w-28" />
            ) : membersError ? (
              <p className="text-sm text-muted-foreground">Unable to load members</p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMembersDialogOpen(true);
                }}
                className="group/members inline-flex cursor-pointer items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={canManageMembers && canViewWorkspaceMembers ? "View and add project members" : "View project members"}
              >
                {projectMembers.length > 0 ? (
                  <AvatarGroup>
                    {visibleMembers.map((member) => (
                      <Avatar key={member.user.id} size="sm" role="img" aria-label={member.user.displayName} title={member.user.displayName}>
                        {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt={member.user.displayName} /> : null}

                        <AvatarFallback>{getMemberInitials(member.user.displayName)}</AvatarFallback>
                      </Avatar>
                    ))}

                    {remainingMembers > 0 ? <AvatarGroupCount className="size-6 text-xs">+{remainingMembers}</AvatarGroupCount> : null}
                  </AvatarGroup>
                ) : (
                  <span className="text-sm text-muted-foreground">No members</span>
                )}
                {canManageMembers && canViewWorkspaceMembers ? (
                  <span className="pointer-events-none inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover/members:opacity-100 group-focus-visible/members:opacity-100">
                    <PlusIcon className="size-3.5" aria-hidden="true" />
                    Add Member
                  </span>
                ) : null}
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Channel Chat</p>

          <div className="mt-2">
            {project.discordChannelUrl ? (
              <a href={project.discordChannelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                Open Discord
                <ArrowSquareOutIcon size={14} aria-hidden="true" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Not Connected</p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Project members</DialogTitle>

            <DialogDescription>Manage the people assigned to this project.</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto">
            {projectMembers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No project members.</p>
            ) : (
              <div className="divide-y">
                {orderedMembers.map((member) => {
                  const soleLead = member.isLead && leads.length === 1;

                  return (
                    <div key={member.user.id} className="flex items-center gap-3 py-3">
                      <Avatar size="sm" role="img" aria-label={member.user.displayName}>
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

                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{getProjectMemberRoleLabel(member)}</p>
                      </div>

                      {canManageMembers ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${member.user.displayName} from project`}
                          title={soleLead ? "Add another project lead before removing this member." : `Remove ${member.user.displayName}`}
                          disabled={collaborationPending || soleLead}
                          onClick={() => {
                            handleRemoveMember(member);
                          }}
                        >
                          <TrashIcon aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canManageMembers && canViewWorkspaceMembers ? (
            <div className="border-t pt-4">
              <p className="text-sm font-medium">Add members to this project</p>

              {workspaceMembersError ? (
                <p className="mt-2 text-xs text-destructive">Unable to load workspace members.</p>
              ) : availableWorkspaceMembers.length === 0 && !workspaceMembersPending ? (
                <p className="mt-2 text-sm text-muted-foreground">All workspace members are already assigned.</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <select
                    aria-label="Workspace member to add"
                    value={memberToAdd}
                    disabled={workspaceMembersPending || collaborationPending}
                    onChange={(event) => {
                      setMemberToAdd(event.target.value);
                    }}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                  >
                    <option value="">Select workspace member</option>

                    {availableWorkspaceMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>

                  <Button type="button" disabled={!memberToAdd || workspaceMembersPending || collaborationPending} onClick={handleAddMember}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const { data: auth } = useMe();
  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);
  const { data: projectMembers = [], isPending: membersPending, isError: membersError } = useProjectMembers(projectId ?? "", Boolean(projectId));
  const canEdit = hasPermission(auth, "projects.edit");
  const canViewClients = hasPermission(auth, "clients.view");
  const canViewWorkspaceMembers = hasPermission(auth, "members.view");

  if (!projectId) {
    return null;
  }

  if (projectPending) {
    return <OverviewSkeleton />;
  }

  if (projectError || !project) {
    return (
      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-destructive">Unable to load project.</p>
        </div>
      </div>
    );
  }

  const canManageMembers = canEdit && (project.visibility === "workspace" || hasPermission(auth, "projects.private.manage"));

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="min-w-0">
              <span className="max-w-56 truncate text-muted-foreground sm:max-w-80" title={project.name}>
                {project.name}
              </span>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbPage>Overview</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-20">
          <div className="min-w-0 max-w-2xl">
            <ProjectIdentityEditor
              key={`${project.id}:${project.updatedAt}`}
              projectId={project.id}
              name={project.name}
              description={project.description}
              projectCode={project.projectCode}
              statusLabel={statusLabels[project.status]}
              canEdit={canEdit}
            />

            <section className="mt-12">
              <h2 className="text-base font-medium tracking-tight">Project Details</h2>

              <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>

                  <StartDateField projectId={project.id} value={project.startDate} canEdit={canEdit} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>

                  <DueDateField projectId={project.id} dueDate={project.dueDate} dueDateMode={project.dueDateMode} canEdit={canEdit} />
                </div>
              </div>

              <div className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Client Name</p>

                  <ClientField project={project} canEdit={canEdit} canViewClients={canViewClients} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Engagement</p>

                  <EngagementField project={project} canEdit={canEdit} />
                </div>
              </div>
            </section>
          </div>

          <CollaborationControls project={project} projectMembers={projectMembers} membersPending={membersPending} membersError={membersError} canEdit={canEdit} canManageMembers={canManageMembers} canViewWorkspaceMembers={canViewWorkspaceMembers} />
        </section>

        <div className="max-w-2xl">
          <KeyResourcesSection projectId={project.id} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}
