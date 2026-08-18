import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { useParams } from "react-router";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useProject } from "@/features/projects/hooks/use-project";

import type { ProjectStatus } from "@/features/projects/types";

const statusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

const engagementLabels = {
  project: "Project",
  retainer: "Retainer",
} as const;

function formatProjectDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
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
          <Skeleton className="h-5 w-20" />

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

export function ProjectOverviewPage() {
  const { projectId } = useParams();

  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);

  const { data: projectMembers = [], isPending: membersPending, isError: membersError } = useProjectMembers(projectId ?? "", Boolean(projectId));

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

  const dueDateLabel = project.dueDate !== null ? formatProjectDate(project.dueDate) : project.engagementType === "retainer" ? "Ongoing" : "Not set";

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Project</span>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbPage>Overview</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight md:text-3xl">{project.name}</h1>

              <Badge variant="outline" className="font-mono text-[11px] tracking-wide text-muted-foreground">
                {project.projectCode}
              </Badge>
              <Badge variant="outline" className="lg:hidden" aria-label={`Project status: ${statusLabels[project.status]}`}>
                {statusLabels[project.status]}
              </Badge>
            </div>

            {project.description ? <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{project.description}</p> : null}
          </div>
          <div className="lg:relative">
            <div className="hidden lg:absolute lg:right-0 lg:top-0 lg:block">
              <Badge variant="outline" aria-label={`Project status: ${statusLabels[project.status]}`}>
                {statusLabels[project.status]}
              </Badge>
            </div>

            <div className="space-y-8 lg:pt-12">
              <Badge variant="outline">{statusLabels[project.status]}</Badge>
            </div>

            <div className="space-y-8 pt-12">
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
                    <a href={project.discordChannelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                      Open Discord
                      <ArrowSquareOutIcon size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-sm font-medium">Timeline</h2>

          <div className="mt-5 grid max-w-md gap-x-10 gap-y-6 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Start date</p>

              <p className="mt-2 text-sm">{formatProjectDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>

              <p className="mt-2 text-sm">{dueDateLabel}</p>
            </div>
          </div>

          <div className="mt-10 grid max-w-md gap-x-10 gap-y-6 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Client Name</p>
              <p className="mt-2 break-words text-sm">{project.client.name}</p>{" "}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engagement</p>

              <p className="mt-2 text-sm">{engagementLabels[project.engagementType]}</p>
            </div>
          </div>
        </section>

        <section className="mt-20 pb-12">
          <h2 className="text-sm font-medium">Key resources</h2>

          <p className="mt-3 text-sm text-muted-foreground">No key resources yet</p>
        </section>
      </div>
    </div>
  );
}
