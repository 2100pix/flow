import { useMemo, useState } from "react";

import { CalendarBlankIcon, CheckIcon, XIcon } from "@phosphor-icons/react";

import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import { Calendar } from "@/components/ui/calendar";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";

import { hasPermission } from "@/features/auth/permissions";

import { useMe } from "@/features/auth/hooks/use-me";

import { useProjectMembers } from "@/features/members/hooks/use-project-members";

import { useArchiveTask } from "../hooks/use-archive-task";

import { useTask } from "../hooks/use-task";

import { useUpdateTask } from "../hooks/use-update-task";

import type { TaskDto, TaskPriority, TaskStatus, TaskWorkflowStatusDto, UpdateTaskInput } from "../types";

type TaskEditorProps = {
  task: TaskDto;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
};

const NO_PRIORITY = "__flow_no_priority__";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function arraysEqual(first: readonly string[], second: readonly string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function parseTaskDate(value: string | null) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function serializeTaskDate(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTaskDate(value: string | null) {
  const date = parseTaskDate(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(displayName: string) {
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

function TaskDateControl({
  label,
  value,
  minimum,
  canClear,
  disabled,
  onValueChange,
}: {
  label: string;

  value: string | null;

  minimum?: string | null;

  canClear: boolean;
  disabled: boolean;

  onValueChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = parseTaskDate(value);

  const minimumDate = parseTaskDate(minimum ?? null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={<Button type="button" variant="outline" className="h-9 w-full justify-start gap-2 px-3 font-normal" />}>
        <CalendarBlankIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

        <span className={value ? "" : "text-muted-foreground"}>{formatTaskDate(value) ?? label}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minimumDate ?? new Date()}
          disabled={
            minimumDate
              ? {
                  before: minimumDate,
                }
              : undefined
          }
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            onValueChange(serializeTaskDate(date));

            setOpen(false);
          }}
        />

        {canClear ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={!value}
              onClick={() => {
                onValueChange(null);

                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function TaskAssigneeControl({
  task,
  value,
  disabled,
  onValueChange,
}: {
  task: TaskDto;

  value: string[];

  disabled: boolean;

  onValueChange: (userIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: projectMembers = [], isPending, isError } = useProjectMembers(task.projectId, open && !disabled);

  const selectedSet = new Set(value);

  const orderedMembers = useMemo(
    () =>
      [...projectMembers].sort((first, second) => {
        const addedOrder = first.addedAt.localeCompare(second.addedAt);

        if (addedOrder !== 0) {
          return addedOrder;
        }

        return first.user.id.localeCompare(second.user.id);
      }),
    [projectMembers],
  );

  const selectedMembers = orderedMembers.filter((member) => selectedSet.has(member.user.id));

  const visible = selectedMembers.slice(0, 4);

  const hiddenCount = Math.max(selectedMembers.length - visible.length, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={<Button type="button" variant="outline" className="h-9 w-full justify-start gap-2 px-3 font-normal" />}>
        {value.length === 0 ? (
          <span className="text-muted-foreground">Unassigned</span>
        ) : (
          <>
            <AvatarGroup className="-space-x-2">
              {visible.map((member) => (
                <Avatar key={member.user.id} size="sm" className="size-5" aria-hidden="true">
                  {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                  <AvatarFallback className="text-[8px]">{getInitials(member.user.displayName)}</AvatarFallback>
                </Avatar>
              ))}

              {hiddenCount > 0 ? <AvatarGroupCount className="size-5 text-[9px]">+{hiddenCount}</AvatarGroupCount> : null}
            </AvatarGroup>

            <span>{value.length === 1 ? "1 assignee" : `${value.length} assignees`}</span>
          </>
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1 text-sm font-medium">Assignees</p>

        <div className="my-1 h-px bg-border" />

        {isPending ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading project members…</p>
        ) : isError ? (
          <p className="px-2 py-3 text-xs text-destructive">Unable to load project members.</p>
        ) : orderedMembers.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No project members.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {orderedMembers.map((member) => {
              const selected = selectedSet.has(member.user.id);

              return (
                <button
                  key={member.user.id}
                  type="button"
                  onClick={() => {
                    onValueChange(selected ? value.filter((userId) => userId !== member.user.id) : [...value, member.user.id]);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar size="sm" aria-hidden="true">
                    {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                    <AvatarFallback>{getInitials(member.user.displayName)}</AvatarFallback>
                  </Avatar>

                  <span className="min-w-0 flex-1 truncate">{member.user.displayName}</span>

                  {selected ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TaskEditor({ task, onClose, workflowStatuses }: TaskEditorProps) {
  const { data: auth } = useMe();

  const canEdit = hasPermission(auth, "tasks.edit");

  const canAssign = hasPermission(auth, "tasks.assign");

  const canArchive = hasPermission(auth, "tasks.archive");

  const [archiveOpen, setArchiveOpen] = useState(false);

  const [title, setTitle] = useState(task.title);

  const [description, setDescription] = useState(task.description ?? "");

  const [status, setStatus] = useState<TaskStatus>(task.status);

  const [priority, setPriority] = useState<TaskPriority | null>(task.priority);

  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((assignee) => assignee.id));

  const [startDate, setStartDate] = useState(task.startDate);

  const [dueDate, setDueDate] = useState<string | null>(task.dueDate);

  const [discordThreadUrl, setDiscordThreadUrl] = useState(task.discordThreadUrl ?? "");

  const updateTask = useUpdateTask();

  const archiveTask = useArchiveTask();

  const editableWorkflowStatuses = workflowStatuses.filter((workflowStatus) => workflowStatus.enabled || workflowStatus.statusKey === task.status).sort((first, second) => first.position - second.position);

  const normalizedTitle = title.trim();

  const normalizedDescription = description.trim() || null;

  const normalizedDiscord = discordThreadUrl.trim() || null;

  const originalAssigneeIds = task.assignees.map((assignee) => assignee.id);

  const dateRangeValid = !dueDate || dueDate >= startDate;

  const editChanged =
    canEdit &&
    (normalizedTitle !== task.title || normalizedDescription !== task.description || status !== task.status || priority !== task.priority || startDate !== task.startDate || dueDate !== task.dueDate || normalizedDiscord !== task.discordThreadUrl);

  const assignmentChanged = canAssign && !arraysEqual(assigneeIds, originalAssigneeIds);

  const dirty = editChanged || assignmentChanged;

  function save() {
    if (updateTask.isPending || !dirty || !dateRangeValid || (canEdit && !normalizedTitle)) {
      return;
    }

    const input: UpdateTaskInput = {};

    if (canEdit) {
      if (normalizedTitle !== task.title) {
        input.title = normalizedTitle;
      }

      if (normalizedDescription !== task.description) {
        input.description = normalizedDescription;
      }

      if (status !== task.status) {
        input.status = status;
      }

      if (priority !== task.priority) {
        input.priority = priority;
      }

      if (startDate !== task.startDate) {
        input.startDate = startDate;
      }

      if (dueDate !== task.dueDate) {
        input.dueDate = dueDate;
      }

      if (normalizedDiscord !== task.discordThreadUrl) {
        input.discordThreadUrl = normalizedDiscord;
      }
    }

    if (assignmentChanged) {
      input.assigneeIds = assigneeIds;
    }

    updateTask.mutate(
      {
        taskId: task.id,
        input,
      },
      {
        onSuccess: () => {
          toast.success("Task updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update task."));
        },
      },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{task.taskCode}</p>

            <label htmlFor="task-title" className="sr-only">
              Task name
            </label>

            <input
              id="task-title"
              value={title}
              disabled={!canEdit}
              maxLength={240}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className="w-full border-0 bg-transparent p-0 text-xl font-semibold leading-7 outline-none placeholder:text-muted-foreground disabled:opacity-100"
            />
          </div>

          <div>
            <label htmlFor="task-description" className="sr-only">
              Description
            </label>

            <textarea
              id="task-description"
              value={description}
              disabled={!canEdit}
              rows={5}
              maxLength={5000}
              placeholder="Add a description"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="min-h-28 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Status</p>

              <Select
                value={status}
                disabled={!canEdit}
                onValueChange={(value) => {
                  const nextStatus = editableWorkflowStatuses.find((workflowStatus) => workflowStatus.statusKey === value);

                  if (nextStatus) {
                    setStatus(nextStatus.statusKey);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-lg px-3">{editableWorkflowStatuses.find((workflowStatus) => workflowStatus.statusKey === status)?.label}</SelectTrigger>

                <SelectContent align="start" alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>

                    <SelectSeparator />

                    {editableWorkflowStatuses.map((workflowStatus) => (
                      <SelectItem key={workflowStatus.statusKey} value={workflowStatus.statusKey}>
                        {workflowStatus.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Priority</p>

              <Select
                value={priority ?? NO_PRIORITY}
                disabled={!canEdit}
                onValueChange={(value) => {
                  if (value === NO_PRIORITY) {
                    setPriority(null);

                    return;
                  }

                  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
                    setPriority(value);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full rounded-lg px-3">{priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "None"}</SelectTrigger>

                <SelectContent align="start" alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectLabel>Priority</SelectLabel>

                    <SelectSeparator />

                    <SelectItem value={NO_PRIORITY}>None</SelectItem>

                    <SelectItem value="low">Low</SelectItem>

                    <SelectItem value="medium">Medium</SelectItem>

                    <SelectItem value="high">High</SelectItem>

                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Assignees</p>

            <TaskAssigneeControl task={task} value={assigneeIds} disabled={!canAssign} onValueChange={setAssigneeIds} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Start date</p>

              <TaskDateControl
                label="Start date"
                value={startDate}
                canClear={false}
                disabled={!canEdit}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }

                  setStartDate(value);

                  if (dueDate && dueDate < value) {
                    setDueDate(null);
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Due date</p>

              <TaskDateControl label="Due date" value={dueDate} minimum={startDate} canClear disabled={!canEdit} onValueChange={setDueDate} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-discord" className="text-xs text-muted-foreground">
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
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-100"
            />

            {task.discordThreadUrl ? (
              <a href={task.discordThreadUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-muted-foreground hover:text-foreground">
                Open discussion
              </a>
            ) : null}
          </div>

          {!dateRangeValid ? <p className="text-sm text-destructive">Due date cannot be before start date.</p> : null}

          {updateTask.isError ? <p className="text-sm text-destructive">{updateTask.error.message}</p> : null}
        </div>
      </div>

      <div className="shrink-0 border-t px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          {canArchive ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={archiveTask.isPending}
              onClick={() => {
                setArchiveOpen(true);
              }}
            >
              Archive task
            </Button>
          ) : (
            <span />
          )}

          {canEdit || canAssign ? (
            <Button type="button" disabled={updateTask.isPending || !dirty || !dateRangeValid || (canEdit && !normalizedTitle)} onClick={save}>
              {updateTask.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive task?</AlertDialogTitle>

            <AlertDialogDescription>
              {task.taskCode} — {task.title} will be removed from the active task workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveTask.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              disabled={archiveTask.isPending}
              onClick={() => {
                archiveTask.mutate(
                  {
                    taskId: task.id,

                    projectId: task.projectId,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Task archived.");

                      onClose();
                    },

                    onError: (error) => {
                      toast.error(getErrorMessage(error, "Failed to archive task."));
                    },
                  },
                );
              }}
            >
              {archiveTask.isPending ? "Archiving…" : "Archive task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TaskDetailSheet({
  taskId,
  onClose,
  workflowStatuses,
}: {
  taskId: string;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
}) {
  const { data: task, isPending, isError } = useTask(taskId);

  return (
    <>
      <button type="button" aria-label="Close task details" onClick={onClose} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />

      <aside aria-label="Task details" className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] border-l bg-background shadow-xl">
        <div className="flex h-14 items-center justify-between border-b px-5">
          <p className="text-sm font-medium">Task details</p>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close task details" onClick={onClose}>
            <XIcon aria-hidden="true" />
          </Button>
        </div>

        <div className="h-[calc(100%-3.5rem)]">
          {isPending ? <div className="p-6 text-sm text-muted-foreground">Loading task…</div> : null}
          {isError ? <div className="p-6 text-sm text-destructive">Unable to load task.</div> : null}
          {task ? <TaskEditor key={task.id} task={task} onClose={onClose} workflowStatuses={workflowStatuses} /> : null}{" "}
        </div>
      </aside>
    </>
  );
}
