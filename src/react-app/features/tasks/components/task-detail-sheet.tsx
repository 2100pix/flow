import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";

import { useArchiveTask } from "../hooks/use-archive-task";
import { useTask } from "../hooks/use-task";
import { useUpdateTask } from "../hooks/use-update-task";
import { useMe } from "@/features/auth/hooks/use-me";

import { hasPermission } from "@/features/auth/permissions";

import type { TaskDto, TaskPriority, TaskStatus, TaskWorkflowStatusDto, UpdateTaskInput } from "../types";

type TaskEditorProps = {
  task: TaskDto;
  onClose: () => void;
  workflowStatuses: readonly TaskWorkflowStatusDto[];
};

function TaskEditor({ task, onClose, workflowStatuses }: TaskEditorProps) {
  const { data: auth } = useMe();

  const canEdit = hasPermission(auth, "tasks.edit");

  const canAssign = hasPermission(auth, "tasks.assign");

  const canArchive = hasPermission(auth, "tasks.archive");

  const { data: projectMembers = [] } = useProjectMembers(task.projectId, canAssign);

  const [title, setTitle] = useState(task.title);

  const [description, setDescription] = useState(task.description ?? "");

  const [status, setStatus] = useState<TaskStatus>(task.status);

  const [priority, setPriority] = useState<TaskPriority | "">(task.priority ?? "");

  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? "");

  const [dueDate, setDueDate] = useState(task.dueDate ?? "");

  const [discordThreadUrl, setDiscordThreadUrl] = useState(task.discordThreadUrl ?? "");

  const updateTask = useUpdateTask();

  const archiveTask = useArchiveTask();

  const enabledWorkflowStatuses = workflowStatuses.filter((workflowStatus) => workflowStatus.enabled);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="task-title" className="mb-1.5 block text-sm font-medium">
              Title
            </label>

            <input
              id="task-title"
              value={title}
              disabled={!canEdit}
              maxLength={240}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="task-description" className="mb-1.5 block text-sm font-medium">
              Description
            </label>

            <textarea
              id="task-description"
              value={description}
              disabled={!canEdit}
              rows={6}
              maxLength={5000}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-status" className="mb-1.5 block text-sm font-medium">
                Status
              </label>

              <select
                id="task-status"
                value={status}
                disabled={!canEdit}
                onChange={(event) => {
                  setStatus(event.target.value as TaskStatus);
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                {enabledWorkflowStatuses.map((workflowStatus) => (
                  <option key={workflowStatus.statusKey} value={workflowStatus.statusKey}>
                    {workflowStatus.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-priority" className="mb-1.5 block text-sm font-medium">
                Priority
              </label>

              <select
                id="task-priority"
                value={priority}
                disabled={!canEdit}
                onChange={(event) => {
                  setPriority(event.target.value as TaskPriority | "");
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="">None</option>

                <option value="low">Low</option>

                <option value="medium">Medium</option>

                <option value="high">High</option>

                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-assignee" className="mb-1.5 block text-sm font-medium">
              Assignee
            </label>

            <select
              id="task-assignee"
              value={assigneeId}
              disabled={!canAssign}
              onChange={(event) => {
                setAssigneeId(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            >
              <option value="">Unassigned</option>

              {projectMembers.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-due-date" className="mb-1.5 block text-sm font-medium">
              Due date
            </label>

            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              disabled={!canEdit}
              onChange={(event) => {
                setDueDate(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="task-discord" className="mb-1.5 block text-sm font-medium">
              Discord thread
            </label>

            <input
              id="task-discord"
              type="url"
              value={discordThreadUrl}
              disabled={!canEdit}
              placeholder="https://discord.com/channels/..."
              onChange={(event) => {
                setDiscordThreadUrl(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            />

            {task.discordThreadUrl ? (
              <a href={task.discordThreadUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
                Open discussion
              </a>
            ) : null}
          </div>

          {updateTask.isError ? <p className="text-sm text-destructive">{updateTask.error.message}</p> : null}

          {(canEdit || canAssign) && (
            <Button
              disabled={updateTask.isPending || (canEdit && !title.trim())}
              onClick={() => {
                const input: UpdateTaskInput = {};

                if (canEdit) {
                  input.title = title.trim();

                  input.description = description.trim() || null;

                  input.status = status;

                  input.priority = priority || null;

                  input.dueDate = dueDate || null;

                  input.discordThreadUrl = discordThreadUrl.trim() || null;
                }

                if (canAssign) {
                  input.assigneeId = assigneeId || null;
                }

                updateTask.mutate({
                  taskId: task.id,

                  input,
                });
              }}
            >
              {updateTask.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>
      </div>
      {canArchive && (
        <div className="shrink-0 border-t p-6">
          {archiveTask.isError ? <p className="mb-3 text-sm text-destructive">{archiveTask.error.message}</p> : null}

          <Button
            variant="destructive"
            disabled={archiveTask.isPending}
            onClick={() => {
              const confirmed = window.confirm(`Archive ${task.title}?`);

              if (!confirmed) {
                return;
              }

              archiveTask.mutate(
                {
                  taskId: task.id,

                  projectId: task.projectId,
                },
                {
                  onSuccess: onClose,
                },
              );
            }}
          >
            {archiveTask.isPending ? "Archiving…" : "Archive task"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function TaskDetailSheet({ taskId, onClose, workflowStatuses }: { taskId: string; onClose: () => void; workflowStatuses: readonly TaskWorkflowStatusDto[] }) {
  const { data: task, isPending, isError } = useTask(taskId);

  return (
    <>
      <button type="button" aria-label="Close task details" onClick={onClose} className="fixed inset-0 z-40 bg-black/20" />

      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] border-l bg-background shadow-xl">
        <div className="flex h-14 items-center justify-between border-b px-5">
          <p className="text-sm font-medium">Task details</p>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="h-[calc(100%-3.5rem)]">
          {isPending ? <div className="p-6 text-sm text-muted-foreground">Loading task…</div> : null}
          {isError ? <div className="p-6 text-sm text-destructive">Unable to load task.</div> : null}
          {task ? <TaskEditor key={task.updatedAt} task={task} onClose={onClose} workflowStatuses={workflowStatuses} /> : null}{" "}
        </div>
      </aside>
    </>
  );
}
