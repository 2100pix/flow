import { useEffect, useRef, useState } from "react";

import { ArrowSquareOutIcon, CalendarBlankIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useParams } from "react-router";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import { useMe } from "@/features/auth/hooks/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";
import { useProject } from "@/features/projects/hooks/use-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";
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

function OverviewSkeleton() {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-4 w-32" />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-12 rounded-md" />
            </div>

            <Skeleton className="mt-4 h-4 w-full max-w-xl" />
            <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
          </div>

          <div className="space-y-7">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        <div className="mt-20">
          <Skeleton className="h-5 w-24" />

          <div className="mt-5 grid max-w-md grid-cols-2 gap-8">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-8">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        <div className="mt-20">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-4 w-44" />
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

    textarea.style.height = `${Math.min(textarea.scrollHeight, 72)}px`;
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
            className="min-w-0 max-w-2xl border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none md:text-3xl"
          />
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
          className="mt-4 min-h-6 w-full max-w-2xl resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/50"
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
      className="-ml-2 mt-1 h-8 max-w-full cursor-pointer rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:bg-muted focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
    >
      {availableClients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
          {client.status === "inactive" ? " (inactive)" : ""}
        </option>
      ))}
    </select>
  );
}

function EngagementField({ project, canEdit }: { project: ProjectDto; canEdit: boolean }) {
  const updateProject = useUpdateProject();

  if (!canEdit) {
    return <p className="mt-2 text-sm">{engagementLabels[project.engagementType]}</p>;
  }

  return (
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
      className="-ml-2 mt-1 h-8 cursor-pointer rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none hover:bg-muted focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
    >
      <option value="project">Project</option>

      <option value="retainer">Retainer</option>
    </select>
  );
}

export function ProjectOverviewPage() {
  const { projectId } = useParams();

  const { data: auth } = useMe();

  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);

  const { data: projectMembers = [], isPending: membersPending, isError: membersError } = useProjectMembers(projectId ?? "", Boolean(projectId));

  const canEdit = hasPermission(auth, "projects.edit");

  const canViewClients = hasPermission(auth, "clients.view");

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

  const lead = project.leadUserId ? projectMembers.find((member) => member.user.id === project.leadUserId) : undefined;

  const visibleMembers = projectMembers.slice(0, 4);

  const remainingMembers = Math.max(projectMembers.length - visibleMembers.length, 0);

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
          <div className="min-w-0">
            <ProjectIdentityEditor
              key={`${project.id}:${project.updatedAt}`}
              projectId={project.id}
              name={project.name}
              description={project.description}
              projectCode={project.projectCode}
              statusLabel={statusLabels[project.status]}
              canEdit={canEdit}
            />
          </div>

          <div className="lg:relative">
            <div className="hidden lg:absolute lg:left-0 lg:top-0 lg:block">
              <Badge variant="outline" aria-label={`Project status: ${statusLabels[project.status]}`}>
                {statusLabels[project.status]}
              </Badge>
            </div>

            <div className="space-y-8 lg:pt-12">
              <div>
                <p className="text-xs text-muted-foreground">Lead Project</p>

                <div className="mt-2">
                  {membersPending ? (
                    <Skeleton className="h-8 w-32" />
                  ) : membersError ? (
                    <p className="text-sm text-muted-foreground">Unable to load lead</p>
                  ) : lead ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm" role="img" aria-label={lead.user.displayName} title={lead.user.displayName}>
                        {lead.user.avatarUrl ? <AvatarImage src={lead.user.avatarUrl} alt="" /> : null}

                        <AvatarFallback>{getMemberInitials(lead.user.displayName)}</AvatarFallback>
                      </Avatar>

                      <span className="text-sm font-medium">{lead.user.displayName}</span>
                    </div>
                  ) : project.leadUserId ? (
                    <p className="text-sm text-muted-foreground">Unavailable</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
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
                  ) : projectMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members</p>
                  ) : (
                    <AvatarGroup>
                      {visibleMembers.map((member) => (
                        <Avatar key={member.user.id} size="sm" role="img" aria-label={member.user.displayName} title={member.user.displayName}>
                          {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt={member.user.displayName} /> : null}

                          <AvatarFallback>{getMemberInitials(member.user.displayName)}</AvatarFallback>
                        </Avatar>
                      ))}

                      {remainingMembers > 0 ? <AvatarGroupCount className="size-6 text-xs">+{remainingMembers}</AvatarGroupCount> : null}
                    </AvatarGroup>
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
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-base font-medium tracking-tight">Project Details</h2>

          <div className="mt-5 grid max-w-md gap-x-10 gap-y-6 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>

              <StartDateField projectId={project.id} value={project.startDate} canEdit={canEdit} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>

              <DueDateField projectId={project.id} dueDate={project.dueDate} dueDateMode={project.dueDateMode} canEdit={canEdit} />
            </div>
          </div>

          <div className="mt-10 grid max-w-md gap-x-10 gap-y-6 sm:grid-cols-2">
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

        <section className="mt-20 pb-12">
          <h2 className="text-base font-medium tracking-tight">Key resources</h2>

          <p className="mt-3 text-sm text-muted-foreground/60">Add a brief, links, more</p>
        </section>
      </div>
    </div>
  );
}
