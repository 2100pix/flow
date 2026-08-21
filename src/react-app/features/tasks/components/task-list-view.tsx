import { useState, type ReactNode } from "react";
import {
  CalendarBlankIcon,
  CellSignalHighIcon,
  CellSignalLowIcon,
  CellSignalMediumIcon,
  CellSignalNoneIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleIcon,
  EyeIcon,
  SpinnerGapIcon,
  UserPlusIcon,
  WarningCircleIcon,
  XCircleIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProjectMembers } from "@/features/members/hooks/use-project-members";
import { useUpdateTask } from "@/features/tasks/hooks/use-update-task";
import type { TaskDto, TaskPriority, TaskStatus, TaskWorkflowStatusDto } from "@/features/tasks/types";

type TaskBoardState = Record<TaskStatus, TaskDto[]>;

type TaskListViewProps = {
  projectId: string;

  statuses: TaskWorkflowStatusDto[];

  workflowStatuses: TaskWorkflowStatusDto[];

  board: TaskBoardState;

  dragDisabled: boolean;
  canEditTask: boolean;
  canAssignTask: boolean;

  onOpenTask: (taskId: string) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
  }).format(date);
}

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

function InlineControl({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center justify-center">{children}</div>;
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const className = "size-3.5 shrink-0";

  switch (status) {
    case "backlog":
      return <CircleDashedIcon className={className} aria-hidden="true" />;

    case "todo":
      return <CircleIcon className={className} aria-hidden="true" />;

    case "in_progress":
      return <SpinnerGapIcon className={className} aria-hidden="true" />;

    case "review":
      return <EyeIcon className={className} aria-hidden="true" />;

    case "done":
      return <CheckCircleIcon weight="fill" className={className} aria-hidden="true" />;

    case "cancelled":
      return <XCircleIcon className={className} aria-hidden="true" />;
  }
}

function TaskPriorityIcon({ priority }: { priority: TaskPriority | null }) {
  const className = "size-3.5 shrink-0";

  switch (priority) {
    case null:
      return <CellSignalNoneIcon className={className} aria-hidden="true" />;

    case "urgent":
      return <WarningCircleIcon className={className} aria-hidden="true" />;

    case "low":
      return <CellSignalLowIcon className={className} aria-hidden="true" />;

    case "medium":
      return <CellSignalMediumIcon className={className} aria-hidden="true" />;

    case "high":
      return <CellSignalHighIcon className={className} aria-hidden="true" />;
  }
}

function TaskAssigneeAvatars({ task }: { task: TaskDto }) {
  if (task.assignees.length === 0) {
    return <UserPlusIcon className="size-3.5" aria-hidden="true" />;
  }

  const visible = task.assignees.slice(0, 4);

  const hidden = Math.max(task.assignees.length - visible.length, 0);

  return (
    <AvatarGroup className="-space-x-2">
      {visible.map((assignee) => (
        <Avatar key={assignee.id} size="sm" className="size-[18px]" aria-hidden="true">
          {assignee.avatarUrl ? <AvatarImage src={assignee.avatarUrl} alt="" /> : null}

          <AvatarFallback className="text-[8px]">{getInitials(assignee.displayName)}</AvatarFallback>
        </Avatar>
      ))}

      {hidden > 0 ? <AvatarGroupCount className="size-[18px] text-[9px]">+{hidden}</AvatarGroupCount> : null}
    </AvatarGroup>
  );
}

function TaskStatusControl({ task, statuses, disabled }: { task: TaskDto; statuses: TaskWorkflowStatusDto[]; disabled: boolean }) {
  const updateTask = useUpdateTask();

  const currentStatus = statuses.find((status) => status.statusKey === task.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || updateTask.isPending}
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="
            h-6
            w-fit
            rounded-full
            px-2
            text-xs
            font-normal
            text-muted-foreground
            hover:bg-muted
            hover:text-foreground
          "
          />
        }
      >
        {currentStatus?.label ?? task.status}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={task.status}
            onValueChange={(value) => {
              const nextStatus = statuses.find((status) => status.statusKey === value);

              if (!nextStatus || nextStatus.statusKey === task.status) {
                return;
              }

              updateTask.mutate(
                {
                  taskId: task.id,

                  input: {
                    status: nextStatus.statusKey,
                  },
                },
                {
                  onError: (error) => {
                    toast.error(getErrorMessage(error, "Failed to update task status."));
                  },
                },
              );
            }}
          >
            {statuses.map((status) => (
              <DropdownMenuRadioItem key={status.statusKey} value={status.statusKey}>
                <TaskStatusIcon status={status.statusKey} />
                {status.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const priorityLabels: Record<TaskPriority, string> = {
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
  urgent: "Urgent",
};

function TaskPriorityControl({ task, disabled }: { task: TaskDto; disabled: boolean }) {
  const updateTask = useUpdateTask();

  const currentValue = task.priority ?? "none";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || updateTask.isPending}
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="
            h-6
            w-fit
            rounded-full
            px-2
            text-xs
            font-normal
            text-muted-foreground
            hover:bg-muted
            hover:text-foreground
          "
          />
        }
      >
        {task.priority ? priorityLabels[task.priority] : "Priority"}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Priority</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={currentValue}
            onValueChange={(value) => {
              const nextPriority = value === "none" ? null : (value as TaskPriority);

              if (nextPriority === task.priority) {
                return;
              }

              updateTask.mutate(
                {
                  taskId: task.id,

                  input: {
                    priority: nextPriority,
                  },
                },
                {
                  onError: (error) => {
                    toast.error(getErrorMessage(error, "Failed to update task priority."));
                  },
                },
              );
            }}
          >
            <DropdownMenuRadioItem value="none">
              <TaskPriorityIcon priority={null} />
              None
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="urgent">
              <TaskPriorityIcon priority="urgent" />
              Urgent
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="low">
              <TaskPriorityIcon priority="low" />
              Low Priority
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">
              <TaskPriorityIcon priority="medium" />
              Medium Priority
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high">
              <TaskPriorityIcon priority="high" />
              High Priority
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskDueDateControl({ task, disabled }: { task: TaskDto; disabled: boolean }) {
  const [open, setOpen] = useState(false);

  const updateTask = useUpdateTask();

  const selected = parseTaskDate(task.dueDate);

  const startDate = parseTaskDate(task.startDate);

  const label = formatTaskDate(task.dueDate);

  function updateDueDate(dueDate: string | null) {
    if (dueDate === task.dueDate) {
      setOpen(false);
      return;
    }

    updateTask.mutate(
      {
        taskId: task.id,

        input: {
          dueDate,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update due date."));
        },
      },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled || updateTask.isPending}
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={label ? `Due ${label}` : "Set due date"}
            className="
            h-6
            w-fit
            rounded-full
            px-2
            text-xs
            font-normal
            text-muted-foreground
            hover:bg-muted
            hover:text-foreground
          "
          />
        }
      >
        <CalendarBlankIcon className="size-3.5" aria-hidden="true" />

        {label ? <span>{label}</span> : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? startDate}
          disabled={
            startDate
              ? {
                  before: startDate,
                }
              : undefined
          }
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            updateDueDate(serializeTaskDate(date));
          }}
        />

        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={!task.dueDate || updateTask.isPending}
            onClick={() => {
              updateDueDate(null);
            }}
          >
            Clear due date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskAssigneeControl({ task, projectId, disabled }: { task: TaskDto; projectId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);

  const { data: projectMembers = [], isPending, isError } = useProjectMembers(projectId, open && !disabled);

  const updateTask = useUpdateTask();

  const selectedIds = task.assignees.map((assignee) => assignee.id);

  const selectedIdSet = new Set(selectedIds);

  const orderedMembers = [...projectMembers].sort((first, second) => {
    const dateOrder = first.addedAt.localeCompare(second.addedAt);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return first.user.id.localeCompare(second.user.id);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled || updateTask.isPending}
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label="Edit task assignees"
            className="
            h-6
            w-fit
            rounded-full
            px-1
            text-muted-foreground
            hover:bg-transparent
            hover:text-muted-foreground
          "
          />
        }
      >
        <TaskAssigneeAvatars task={task} />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Assignees</p>

        {isPending ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading project members…</p>
        ) : isError ? (
          <p className="px-2 py-3 text-xs text-destructive">Unable to load project members.</p>
        ) : orderedMembers.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No project members.</p>
        ) : (
          <div className="mt-1 max-h-72 space-y-1 overflow-y-auto">
            {orderedMembers.map((member) => {
              const selected = selectedIdSet.has(member.user.id);

              return (
                <button
                  key={member.user.id}
                  type="button"
                  disabled={updateTask.isPending}
                  onClick={() => {
                    const nextIds = selected ? selectedIds.filter((userId) => userId !== member.user.id) : [...selectedIds, member.user.id];

                    updateTask.mutate(
                      {
                        taskId: task.id,

                        input: {
                          assigneeIds: nextIds,
                        },
                      },
                      {
                        onError: (error) => {
                          toast.error(getErrorMessage(error, "Failed to update task assignees."));
                        },
                      },
                    );
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
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

function TaskListRow({
  task,
  index,
  status,
  workflowStatuses,
  projectId,
  dragDisabled,
  canEditTask,
  canAssignTask,
  onOpen,
}: {
  task: TaskDto;
  index: number;
  status: TaskStatus;

  workflowStatuses: TaskWorkflowStatusDto[];

  projectId: string;

  dragDisabled: boolean;
  canEditTask: boolean;
  canAssignTask: boolean;

  onOpen: () => void;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: task.id,
    index,
    group: status,

    type: "task",
    accept: "task",

    disabled: dragDisabled,
  });

  return (
    <div ref={ref} className={["group flex min-h-11 min-w-0 flex-col gap-2 py-1 transition-opacity md:flex-row md:items-center md:justify-between", isDragSource ? "opacity-50" : ""].join(" ")}>
      <button
        ref={handleRef}
        type="button"
        onClick={onOpen}
        aria-label={`Open ${task.title}`}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-4 rounded-sm text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring md:gap-7"
      >
        <span className="w-[78px] shrink-0 truncate text-xs text-muted-foreground">{task.taskCode}</span>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
      </button>

      <div className="flex w-full flex-wrap items-center justify-end gap-1 md:w-auto md:flex-nowrap md:gap-2">
        <InlineControl>
          <TaskStatusControl task={task} statuses={workflowStatuses} disabled={!canEditTask} />
        </InlineControl>

        <InlineControl>
          <TaskPriorityControl task={task} disabled={!canEditTask} />
        </InlineControl>

        <InlineControl>
          <TaskDueDateControl task={task} disabled={!canEditTask} />
        </InlineControl>

        <InlineControl>
          <TaskAssigneeControl task={task} projectId={projectId} disabled={!canAssignTask} />
        </InlineControl>
      </div>
    </div>
  );
}

function TaskListSection({
  projectId,
  status,
  label,
  tasks,
  workflowStatuses,
  dragDisabled,
  canEditTask,
  canAssignTask,
  onOpenTask,
}: {
  projectId: string;
  status: TaskStatus;
  label: string;
  tasks: TaskDto[];

  workflowStatuses: TaskWorkflowStatusDto[];

  dragDisabled: boolean;
  canEditTask: boolean;
  canAssignTask: boolean;

  onOpenTask: (taskId: string) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: status,
    accept: "task",

    collisionPriority: -1,

    disabled: dragDisabled,
  });

  return (
    <section ref={ref} className="space-y-2">
      <h2 className="px-3 text-base font-medium text-muted-foreground">{label}</h2>
      <div className={["min-h-12 overflow-hidden rounded-lg bg-muted/30 px-3", "dark:bg-muted/25", isDropTarget ? "ring-2 ring-ring/30" : ""].join(" ")}>
        <div className="divide-y divide-border/60">
          {tasks.length === 0 ? (
            <div className="flex min-h-10 items-center px-1 text-xs text-muted-foreground/50">No tasks</div>
          ) : (
            tasks.map((task, index) => (
              <TaskListRow
                key={task.id}
                task={task}
                index={index}
                status={status}
                workflowStatuses={workflowStatuses}
                projectId={projectId}
                dragDisabled={dragDisabled}
                canEditTask={canEditTask}
                canAssignTask={canAssignTask}
                onOpen={() => {
                  onOpenTask(task.id);
                }}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export function TaskListView({ projectId, statuses, workflowStatuses, board, dragDisabled, canEditTask, canAssignTask, onOpenTask }: TaskListViewProps) {
  return (
    <div className="space-y-3">
      {" "}
      {statuses
        .filter((status) => board[status.statusKey].length > 0)
        .map((status) => (
          <TaskListSection
            key={status.statusKey}
            projectId={projectId}
            status={status.statusKey}
            label={status.label}
            tasks={board[status.statusKey]}
            workflowStatuses={workflowStatuses}
            dragDisabled={dragDisabled}
            canEditTask={canEditTask}
            canAssignTask={canAssignTask}
            onOpenTask={onOpenTask}
          />
        ))}
    </div>
  );
}
