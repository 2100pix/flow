import { useState } from "react";
import { PlusIcon, UserFocusIcon, UserMinusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import { useAddProjectMember } from "@/features/members/hooks/use-add-project-member";
import { useMembers } from "@/features/members/hooks/use-members";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useRemoveProjectMember } from "@/features/members/hooks/use-remove-project-member";
import type { ProjectMemberDto } from "@/features/members/types";
import { PROJECT_LEAD_MAX_COUNT } from "@/features/projects/constants";
import { useUpdateProjectLeads } from "@/features/projects/hooks/use-update-project-leads";
import type { ProjectDto } from "@/features/projects/types";
import { getErrorMessage } from "@/lib/errors";
import { resolvePersonName } from "@/lib/person-name";

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

type PersonLike = {
  firstName?: string | null;

  lastName?: string | null;

  displayName: string;
};

function getName(person: PersonLike) {
  return resolvePersonName({
    firstName: person.firstName,

    lastName: person.lastName,

    displayName: person.displayName,
  });
}

function getSecondaryLabel(member: ProjectMemberDto) {
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

type InviteMembersControlProps = {
  projectId: string;
  assignedUserIds: string[];
  canManageMembers: boolean;
  canViewWorkspaceMembers: boolean;
  mode: "full" | "icon";
};

function InviteMembersControl({ projectId, assignedUserIds, canManageMembers, canViewWorkspaceMembers, mode }: InviteMembersControlProps) {
  const [open, setOpen] = useState(false);
  const { data: workspaceMembers = [], isPending, isError } = useMembers(open && canManageMembers && canViewWorkspaceMembers);
  const addMember = useAddProjectMember();
  const assignedIds = new Set(assignedUserIds);
  const candidates = workspaceMembers.filter((member) => !assignedIds.has(member.id));

  if (!canManageMembers || !canViewWorkspaceMembers) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          mode === "full" ? (
            <Button type="button" size="sm" className="h-8 gap-1.5 rounded-[10px] px-2.5" aria-label="Invite project members" />
          ) : (
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label="Invite project member" />
          )
        }
      >
        <PlusIcon aria-hidden="true" />

        {mode === "full" ? "Invite Members" : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Invite Members</p>

        {isPending ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading workspace members…</p>
        ) : isError ? (
          <p className="px-2 py-3 text-xs text-destructive">Unable to load workspace members.</p>
        ) : candidates.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">All workspace members are already assigned.</p>
        ) : (
          <div className="mt-1 space-y-1">
            {candidates.map((member) => (
              <button
                key={member.id}
                type="button"
                disabled={addMember.isPending}
                onClick={() => {
                  addMember.mutate(
                    {
                      projectId,
                      userId: member.id,
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
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                <Avatar size="sm" aria-hidden="true">
                  {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}

                  <AvatarFallback>{getInitials(getName(member))}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate">{getName(member)}</p>

                  <p className="truncate text-xs text-muted-foreground">{member.customRole?.name ?? member.role}</p>
                </div>

                <PlusIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

type ProjectSettingsTeamProps = {
  project: ProjectDto;
  canEdit: boolean;
  canManageMembers: boolean;
  canViewWorkspaceMembers: boolean;
};

export function ProjectSettingsTeam({ project, canEdit, canManageMembers, canViewWorkspaceMembers }: ProjectSettingsTeamProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: projectMembers = [], isPending, isError } = useProjectMembers(project.id);
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

  /*
   * Settings intentionally
   * separates the two surfaces:
   *
   * Lead Project = leads
   * Team members = non-leads
   */
  const teamMembers = orderedMembers.filter((member) => !member.isLead);
  const leadIds = leads.map((lead) => lead.user.id);
  const visibleMembers = expanded ? teamMembers : teamMembers.slice(0, 4);
  const hiddenCount = Math.max(teamMembers.length - 4, 0);
  const mutationPending = removeMember.isPending || updateLeads.isPending;

  function setAsLead(userId: string) {
    if (!canEdit || mutationPending || leadIds.length >= PROJECT_LEAD_MAX_COUNT) {
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
    if (!canEdit || mutationPending || leadIds.length <= 1) {
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

  function removeTeamMember(member: ProjectMemberDto) {
    if (!canManageMembers || mutationPending) {
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

  if (isPending) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive">Unable to load project members.</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium">Lead Project</h2>

        <div className="mt-3 divide-y divide-border/60 border-b border-border/60">
          {leads.map((lead) => {
            const soleLead = leads.length === 1;

            return (
              <div key={lead.user.id} className="flex min-w-0 items-center gap-4 py-4">
                <Avatar size="default" aria-hidden="true">
                  {lead.user.avatarUrl ? <AvatarImage src={lead.user.avatarUrl} alt="" /> : null}

                  <AvatarFallback>{getInitials(getName(lead.user))}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{getName(lead.user)}</p>

                  <p className="mt-1 truncate text-xs text-muted-foreground">{getSecondaryLabel(lead)}</p>
                </div>

                <Badge variant="outline" className="h-6 min-w-[51px] justify-center rounded-md px-2 text-xs font-medium text-muted-foreground">
                  Lead
                </Badge>

                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full text-muted-foreground"
                    aria-label={`Remove ${getName(lead.user)} as project lead`}
                    title={soleLead ? "Assign another project lead before removing this lead" : `Remove ${getName(lead.user)} as project lead`}
                    disabled={soleLead || mutationPending}
                    onClick={() => {
                      removeLead(lead.user.id);
                    }}
                  >
                    <UserMinusIcon aria-hidden="true" className="size-5" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Team members</h2>

        {teamMembers.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            {leads.length > 0 ? (
              <div className="flex -space-x-2">
                {leads.slice(0, 3).map((lead) => (
                  <Avatar key={lead.user.id} className="size-12 border border-border" aria-hidden="true">
                    {lead.user.avatarUrl ? <AvatarImage src={lead.user.avatarUrl} alt="" /> : null}

                    <AvatarFallback>{getInitials(getName(lead.user))}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : null}

            <p className="max-w-52 text-sm leading-5 text-muted-foreground">Invite your team to collaborate on this project.</p>

            <InviteMembersControl projectId={project.id} assignedUserIds={orderedMembers.map((member) => member.user.id)} canManageMembers={canManageMembers} canViewWorkspaceMembers={canViewWorkspaceMembers} mode="full" />
          </div>
        ) : (
          <>
            <div className="mt-3 divide-y divide-border/60 border-b border-border/60">
              {visibleMembers.map((member) => (
                <div key={member.user.id} className="flex min-w-0 items-center gap-4 py-4">
                  <Avatar size="default" aria-hidden="true">
                    {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                    <AvatarFallback>{getInitials(getName(member.user))}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{getName(member.user)}</p>

                    <p className="mt-1 truncate text-xs text-muted-foreground">{getSecondaryLabel(member)}</p>
                  </div>

                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full text-muted-foreground"
                      aria-label={`Set ${getName(member.user)} as project lead`}
                      title={leadIds.length >= PROJECT_LEAD_MAX_COUNT ? "Maximum three project leads" : `Set ${getName(member.user)} as project lead`}
                      disabled={mutationPending || leadIds.length >= PROJECT_LEAD_MAX_COUNT}
                      onClick={() => {
                        setAsLead(member.user.id);
                      }}
                    >
                      <UserFocusIcon aria-hidden="true" className="size-[26px]" />
                    </Button>
                  ) : null}

                  {canManageMembers ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full text-muted-foreground"
                      aria-label={`Remove ${getName(member.user)} from project`}
                      title={`Remove ${getName(member.user)} from project`}
                      disabled={mutationPending}
                      onClick={() => {
                        removeTeamMember(member);
                      }}
                    >
                      <UserMinusIcon aria-hidden="true" className="size-5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-2 flex min-h-9 items-center justify-between">
              {hiddenCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2"
                  onClick={() => {
                    setExpanded((current) => !current);
                  }}
                >
                  {expanded ? "Show less" : "View more"}
                </Button>
              ) : (
                <span />
              )}

              <InviteMembersControl projectId={project.id} assignedUserIds={orderedMembers.map((member) => member.user.id)} canManageMembers={canManageMembers} canViewWorkspaceMembers={canViewWorkspaceMembers} mode="icon" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
