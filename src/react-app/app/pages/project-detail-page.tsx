import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useArchiveProject } from "@/features/projects/hooks/use-archive-project";
import { useProject } from "@/features/projects/hooks/use-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";
import { hasPermission } from "@/features/auth/permissions";

import { useAddProjectMember } from "@/features/members/hooks/use-add-project-member";
import { useMembers } from "@/features/members/hooks/use-members";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useRemoveProjectMember } from "@/features/members/hooks/use-remove-project-member";
import { TaskWorkflowSettings } from "@/features/tasks/components/task-workflow-settings";

import { type ProjectStatus, type ProjectDto } from "@/features/projects/types";

import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";

type ProjectEditorProps = {
  project: ProjectDto;
  canEdit: boolean;
  canArchive: boolean;
  canManageVisibility: boolean;
  canViewClients: boolean;
};

function ProjectEditor({ project, canEdit, canArchive, canManageVisibility, canViewClients }: ProjectEditorProps) {
  const navigate = useNavigate();
  const canChangeClient = canEdit && canViewClients;
  const { data: clients = [] } = useClients(canChangeClient);
  const [clientId, setClientId] = useState(project.client?.id ?? "");
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [visibility, setVisibility] = useState<ProjectDto["visibility"]>(project.visibility);
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [discordChannelUrl, setDiscordChannelUrl] = useState(project.discordChannelUrl ?? "");
  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();
  const availableClients = clients.filter((client) => client.status === "active" || client.id === project.client?.id);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border p-5">
        <div className="grid max-w-3xl gap-5">
          <div>
            <label htmlFor="project-name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>

            <input
              id="project-name"
              value={name}
              maxLength={160}
              disabled={!canEdit}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor={canChangeClient ? "project-client" : undefined} className="mb-1.5 block text-sm font-medium">
              Client
            </label>

            {canChangeClient ? (
              <select
                id="project-client"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                }}
                className="h-8 w-full max-w-sm rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="">Select client</option>
                {availableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.status === "inactive" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-foreground">{project.client?.name ?? "Not set"}</p>
            )}
          </div>

          <div>
            <label htmlFor="project-status" className="mb-1.5 block text-sm font-medium">
              Status
            </label>

            <select
              id="project-status"
              value={status}
              disabled={!canEdit}
              onChange={(event) => {
                setStatus(event.target.value as ProjectStatus);
              }}
              className="h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="planning">Planning</option>

              <option value="active">Active</option>

              <option value="on_hold">On hold</option>

              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label htmlFor="project-visibility" className="mb-1.5 block text-sm font-medium">
              Visibility
            </label>

            <select
              id="project-visibility"
              value={visibility}
              disabled={!canManageVisibility}
              onChange={(event) => {
                setVisibility(event.target.value as ProjectDto["visibility"]);
              }}
              className="h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="workspace">Workspace</option>

              <option value="private">Private</option>
            </select>

            <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">
              {visibility === "private" ? "Private projects are restricted to project members and roles with access to all private projects." : "Workspace projects are discoverable by workspace members with project access."}
            </p>
          </div>
          <div>
            <label htmlFor="project-description" className="mb-1.5 block text-sm font-medium">
              Description
            </label>

            <textarea
              id="project-description"
              value={description}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              disabled={!canEdit}
              rows={5}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="project-start" className="mb-1.5 block text-sm font-medium">
                Start date
              </label>

              <input
                id="project-start"
                type="date"
                value={startDate}
                disabled={!canEdit}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="project-due" className="mb-1.5 block text-sm font-medium">
                Due date
              </label>

              <input
                id="project-due"
                type="date"
                value={dueDate}
                disabled={!canEdit}
                onChange={(event) => {
                  setDueDate(event.target.value);
                }}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="project-discord" className="mb-1.5 block text-sm font-medium">
              Discord channel
            </label>

            <input
              id="project-discord"
              type="url"
              value={discordChannelUrl}
              disabled={!canEdit}
              placeholder="https://discord.com/channels/..."
              onChange={(event) => {
                setDiscordChannelUrl(event.target.value);
              }}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            />

            {project.discordChannelUrl ? (
              <a href={project.discordChannelUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
                Open Discord channel
              </a>
            ) : null}
          </div>

          {updateProject.isError ? <p className="text-sm text-destructive">{updateProject.error.message}</p> : null}

          {canEdit ? (
            <Button
              className="w-fit"
              disabled={!name.trim() || updateProject.isPending}
              onClick={() => {
                updateProject.mutate({
                  projectId: project.id,

                  input: {
                    ...(canChangeClient
                      ? {
                          clientId: clientId || null,
                        }
                      : {}),
                    name: name.trim(),
                    description: description.trim() || null,
                    status,
                    ...(canManageVisibility ? { visibility } : {}),
                    startDate: startDate || null,
                    dueDate: dueDate || null,
                    discordChannelUrl: discordChannelUrl.trim() || null,
                  },
                });
              }}
            >
              {updateProject.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>

      {canArchive ? (
        <div className="rounded-lg border border-destructive/20 p-5">
          <p className="text-sm font-medium">Delete project</p>

          <p className="mt-1 text-sm text-muted-foreground">Deleted projects are removed from active project views. The current delete behavior archives project data instead of permanently removing it.</p>

          {archiveProject.isError ? <p className="mt-3 text-sm text-destructive">{archiveProject.error.message}</p> : null}

          <Button
            className="mt-4"
            variant="destructive"
            disabled={archiveProject.isPending}
            onClick={() => {
              const confirmed = window.confirm(`Delete ${project.name}? This removes the project from active project views.`);
              if (!confirmed) {
                return;
              }

              archiveProject.mutate(project.id, {
                onSuccess: () => {
                  void navigate("/projects", {
                    replace: true,
                  });
                },
              });
            }}
          >
            {archiveProject.isPending ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectTeam({ projectId, canManage, canViewMembers, isPrivate }: { projectId: string; canManage: boolean; canViewMembers: boolean; isPrivate: boolean }) {
  const [userId, setUserId] = useState("");

  const { data: members = [] } = useMembers(canViewMembers);

  const { data: projectMembers = [], isPending, isError } = useProjectMembers(projectId);

  const addMember = useAddProjectMember();

  const removeMember = useRemoveProjectMember();

  const assignedIds = new Set(projectMembers.map((member) => member.user.id));

  const availableMembers = members.filter((member) => !assignedIds.has(member.id));

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium">Team</p>
          <p className="mt-1 text-sm text-muted-foreground">{isPrivate ? "Project members can access this private project." : "Workspace members assigned to this project."}</p>{" "}
        </div>

        {canManage && availableMembers.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
              }}
              className="h-8 w-52 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            >
              <option value="">Select member</option>

              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>

            <Button
              disabled={!userId || addMember.isPending}
              onClick={() => {
                addMember.mutate(
                  {
                    projectId,
                    userId,
                  },
                  {
                    onSuccess: () => {
                      setUserId("");
                    },
                  },
                );
              }}
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>

      {isPending ? <p className="mt-4 text-sm text-muted-foreground">Loading team…</p> : null}

      {isError ? <p className="mt-4 text-sm text-destructive">Unable to load project team.</p> : null}

      {addMember.isError ? <p className="mt-4 text-sm text-destructive">{addMember.error.message}</p> : null}

      {projectMembers.length === 0 && !isPending ? <p className="mt-4 text-sm text-muted-foreground">No project members yet.</p> : null}

      {projectMembers.length > 0 ? (
        <div className="mt-4 divide-y rounded-lg border">
          {projectMembers.map((member) => (
            <div key={member.user.id} className="flex items-center gap-3 px-3 py-2.5">
              {member.user.avatarUrl ? (
                <img src={member.user.avatarUrl} alt="" className="size-7 rounded-full" />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">{member.user.displayName.charAt(0).toUpperCase()}</div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.user.displayName}</p>

                <p className="text-xs capitalize text-muted-foreground">{member.user.role}</p>
              </div>

              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeMember.isPending}
                  onClick={() => {
                    removeMember.mutate({
                      projectId,
                      userId: member.user.id,
                    });
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { data: auth } = useMe();
  const { data: project, isPending, isError } = useProject(projectId);
  if (!projectId) {
    return null;
  }
  const canViewClients = hasPermission(auth, "clients.view");
  const canEdit = hasPermission(auth, "projects.edit");
  const canManagePrivate = hasPermission(auth, "projects.private.manage");
  const canManageVisibility = canEdit && canManagePrivate;
  const canArchive = hasPermission(auth, "projects.archive");
  const canManageTeam = canEdit && (project?.visibility === "workspace" || (project?.visibility === "private" && canManagePrivate));
  const canViewMembers = hasPermission(auth, "members.view");

  const canViewTaskWorkflow = hasPermission(auth, "tasks.view");
  const canManageTaskWorkflow = hasPermission(auth, "tasks.edit");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Link to={`/projects/${projectId}`}>Overview</Link>
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Project Settings</h1>
              {project?.visibility === "private" ? <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium">Private</span> : null}
            </div>
            {project ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.name} · {project.client?.name ?? "No client"}
              </p>
            ) : null}
          </div>

          {project ? (
            <Link to={`/projects/${project.id}/board`} className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted">
              Open board
            </Link>
          ) : null}
        </div>

        {isPending ? <p className="text-sm text-muted-foreground">Loading project…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load project.</p> : null}

        {project ? (
          <>
            <ProjectEditor key={project.updatedAt} project={project} canEdit={canEdit} canArchive={canArchive} canManageVisibility={canManageVisibility} canViewClients={canViewClients} />{" "}
            {canViewTaskWorkflow ? <TaskWorkflowSettings projectId={project.id} canManage={canManageTaskWorkflow} /> : null}
            <ProjectTeam projectId={project.id} canManage={canManageTeam} canViewMembers={canViewMembers} isPrivate={project.visibility === "private"} />
          </>
        ) : null}
      </div>
    </div>
  );
}
