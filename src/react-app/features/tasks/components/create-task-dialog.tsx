import { useMemo, useState } from "react";

import {
  CalendarBlankIcon,
  CellSignalHighIcon,
  CellSignalLowIcon,
  CellSignalMediumIcon,
  CellSignalNoneIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleDashedIcon,
  CircleIcon,
  EyeIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import { Calendar } from "@/components/ui/calendar";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";

import { useProjectMembers } from "@/features/members/hooks/use-project-members";

import { useCreateTask } from "@/features/tasks/hooks/use-create-task";

import type { TaskPriority, TaskStatus, TaskWorkflowStatusDto } from "@/features/tasks/types";
import { getErrorMessage } from "@/lib/errors";
import { resolvePersonName } from "@/lib/person-name";

type CreateTaskDialogProps = {
  open: boolean;
  projectId: string;

  statuses: TaskWorkflowStatusDto[];

  initialStatus: TaskStatus;

  onClose: () => void;
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string | null) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function serializeDate(date: Date) {
  return getLocalDateString(date);
}

function formatDate(value: string | null) {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const className = "size-4";

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

function TaskStatusPicker({
  value,
  statuses,
  disabled,
  onValueChange,
}: {
  value: TaskStatus;

  statuses: TaskWorkflowStatusDto[];

  disabled: boolean;

  onValueChange: (status: TaskStatus) => void;
}) {
  const current = statuses.find((status) => status.statusKey === value);

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const nextStatus = statuses.find((status) => status.statusKey === nextValue);

        if (!nextStatus) {
          return;
        }

        onValueChange(nextStatus.statusKey);
      }}
    >
      <SelectTrigger aria-label={`Task status: ${current?.label ?? value}`} className="h-8 w-auto min-w-0 gap-1.5 rounded-lg px-2.5 text-xs">
        <TaskStatusIcon status={value} />

        <span>{current?.label ?? value}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Status</SelectLabel>

          <SelectSeparator />

          {statuses.map((status) => (
            <SelectItem key={status.statusKey} value={status.statusKey}>
              <TaskStatusIcon status={status.statusKey} />

              {status.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TaskPriorityIcon({ priority }: { priority: TaskPriority | null }) {
  const className = "size-4";

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

const priorityLabels = {
  urgent: "Urgent",
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
} satisfies Record<TaskPriority, string>;

const NO_PRIORITY = "__flow_no_priority__";

function TaskPriorityPicker({
  value,
  disabled,
  onValueChange,
}: {
  value: TaskPriority | null;

  disabled: boolean;

  onValueChange: (priority: TaskPriority | null) => void;
}) {
  return (
    <Select
      value={value ?? NO_PRIORITY}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue === NO_PRIORITY) {
          onValueChange(null);

          return;
        }

        if (nextValue === "urgent" || nextValue === "high" || nextValue === "medium" || nextValue === "low") {
          onValueChange(nextValue);
        }
      }}
    >
      <SelectTrigger aria-label={`Task priority: ${value ? priorityLabels[value] : "None"}`} className="h-8 w-auto min-w-0 gap-1.5 rounded-lg px-2.5 text-xs">
        <TaskPriorityIcon priority={value} />

        <span>{value ? priorityLabels[value] : "None"}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Priority</SelectLabel>

          <SelectSeparator />

          <SelectItem value={NO_PRIORITY}>
            <TaskPriorityIcon priority={null} />
            None
          </SelectItem>

          {(["urgent", "low", "medium", "high"] as const).map((priority) => (
            <SelectItem key={priority} value={priority}>
              <TaskPriorityIcon priority={priority} />

              {priorityLabels[priority]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TaskAssigneePicker({
  projectId,
  value,
  disabled,
  onValueChange,
}: {
  projectId: string;

  value: string[];

  disabled: boolean;

  onValueChange: (userIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: projectMembers = [], isPending, isError } = useProjectMembers(projectId, open && !disabled);

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

  const visibleAvatars = selectedMembers.slice(0, 3);

  const hiddenCount = Math.max(selectedMembers.length - visibleAvatars.length, 0);

  const assigneeLabel = selectedMembers.length > 0 ? `Assignees: ${selectedMembers.map((member) => getName(member.user)).join(", ")}` : "Assignees";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant={selectedMembers.length === 0 ? "outline" : "ghost"}
            aria-label={assigneeLabel}
            title={assigneeLabel}
            className={
              selectedMembers.length === 0 ? "h-8 w-auto justify-start rounded-lg px-2.5 text-xs font-normal" : "h-8 w-auto justify-start border-0 bg-transparent p-0 shadow-none hover:bg-transparent hover:text-foreground focus-visible:bg-transparent"
            }
          />
        }
      >
        {selectedMembers.length === 0 ? (
          "Assignees"
        ) : (
          <AvatarGroup className="-space-x-1.5">
            {visibleAvatars.map((member) => (
              <Avatar key={member.user.id} size="sm" className="size-[18px]" aria-hidden="true">
                {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                <AvatarFallback className="text-[8px]">{getInitials(getName(member.user))}</AvatarFallback>
              </Avatar>
            ))}

            {hiddenCount > 0 ? <AvatarGroupCount className="size-[18px] text-[8px]">+{hiddenCount}</AvatarGroupCount> : null}
          </AvatarGroup>
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-0">
        <div className="p-1">
          <div className="px-1.5 py-1 text-xs text-muted-foreground">Assignees</div>

          <div className="-mx-1 my-1 h-px bg-border" />

          {isPending ? (
            <p className="px-1.5 py-3 text-xs text-muted-foreground">Loading project members…</p>
          ) : isError ? (
            <p className="px-1.5 py-3 text-xs text-destructive">Unable to load project members.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {orderedMembers.map((member) => {
                const selected = selectedSet.has(member.user.id);

                return (
                  <button
                    key={member.user.id}
                    type="button"
                    onClick={() => {
                      onValueChange(selected ? value.filter((userId) => userId !== member.user.id) : [...value, member.user.id]);
                    }}
                    className="
                        relative
                        flex h-8 w-full
                        cursor-default
                        items-center gap-1.5
                        rounded-md
                        py-1 pr-8 pl-1.5
                        text-left text-sm
                        outline-none
                        hover:bg-foreground/10
                        focus-visible:bg-foreground/10
                      "
                  >
                    <Avatar size="sm" className="size-5" aria-hidden="true">
                      {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                      <AvatarFallback className="text-[9px]">{getInitials(getName(member.user))}</AvatarFallback>
                    </Avatar>

                    <span className="min-w-0 flex-1 truncate">{getName(member.user)}</span>

                    {selected ? <CheckIcon className="absolute right-2 size-4" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskDatePicker({
  label,
  value,
  minDate,
  disabled,
  onValueChange,
}: {
  label: string;

  value: string | null;

  minDate?: string | null;

  disabled: boolean;

  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = parseDate(value);

  const minimum = parseDate(minDate ?? null);

  const formatted = formatDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={<Button type="button" variant="outline" size="sm" className="h-8 w-fit gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground shadow-xs" />}>
        <CalendarBlankIcon className="size-4" aria-hidden="true" />

        {formatted ?? label}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minimum ?? new Date()}
          disabled={
            minimum
              ? {
                  before: minimum,
                }
              : undefined
          }
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onSelect={(date) => {
            if (!date) {
              return;
            }

            onValueChange(serializeDate(date));

            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function CreateTaskDialog({ open, projectId, statuses, initialStatus, onClose }: CreateTaskDialogProps) {
  const enabledStatuses = useMemo(() => [...statuses].filter((status) => status.enabled).sort((first, second) => first.position - second.position), [statuses]);

  const resolvedInitialStatus = enabledStatuses.some((status) => status.statusKey === initialStatus) ? initialStatus : (enabledStatuses[0]?.statusKey ?? "backlog");

  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [status, setStatus] = useState<TaskStatus>(resolvedInitialStatus);

  const [priority, setPriority] = useState<TaskPriority | null>(null);

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const [startDate, setStartDate] = useState<string | null>(null);

  const [dueDate, setDueDate] = useState<string | null>(null);

  const createTask = useCreateTask();

  const effectiveStartDate = startDate ?? getLocalDateString();

  const dateRangeValid = !dueDate || dueDate >= effectiveStartDate;

  function close() {
    if (createTask.isPending) {
      return;
    }

    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <DialogContent
        showCloseButton={!createTask.isPending}
        className="
          flex
          h-[473px]
          w-[603px]
          max-h-[calc(100dvh-2rem)]
          max-w-[calc(100vw-2rem)]!
          sm:max-w-[603px]!
          flex-col
          gap-4
          overflow-y-auto
          rounded-[10px]
          p-6
          shadow-lg
          sm:overflow-hidden
          [&>[data-slot=dialog-close]]:right-[18px]
          [&>[data-slot=dialog-close]]:top-6
          [&>[data-slot=dialog-close]]:size-7
          [&>[data-slot=dialog-close]]:bg-transparent
          [&>[data-slot=dialog-close]>svg]:opacity-70
        "
      >
        <DialogHeader className="h-14 shrink-0 gap-2 p-0">
          <DialogTitle className="pr-10 text-lg font-semibold leading-7">Create a new task</DialogTitle>

          <div aria-hidden="true" className="h-5 w-full shrink-0" />
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            const taskTitle = title.trim();

            if (!taskTitle || !dateRangeValid || createTask.isPending) {
              return;
            }

            createTask.mutate(
              {
                projectId,

                input: {
                  title: taskTitle,

                  description: description.trim() || undefined,

                  status,

                  priority,

                  assigneeIds,

                  /*
                   * Explicit browser-local
                   * date prevents the UTC
                   * rollover problem.
                   */
                  startDate: effectiveStartDate,

                  dueDate,
                },
              },
              {
                onSuccess: () => {
                  toast.success("Task created.");

                  onClose();
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to create task."));
                },
              },
            );
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-[15px]">
            <div className="h-[35px] shrink-0">
              <label htmlFor="create-task-title" className="sr-only">
                Task name
              </label>

              <input
                id="create-task-title"
                value={title}
                maxLength={240}
                autoFocus
                disabled={createTask.isPending}
                placeholder="Task name"
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                className="
                  h-[35px]
                  w-full
                  rounded-none
                  border-0
                  bg-transparent
                  px-0
                  py-1
                  text-base
                  font-medium
                  shadow-none
                  outline-none
                  ring-0
                  placeholder:font-medium
                  placeholder:text-muted-foreground
                  focus:border-transparent
                  focus:outline-none
                  focus:ring-0
                  focus-visible:border-transparent
                  focus-visible:outline-none
                  focus-visible:ring-0
                  disabled:opacity-50
                "
              />
            </div>

            <div className="min-h-[130px] flex-1">
              <label htmlFor="create-task-description" className="sr-only">
                Description
              </label>

              <textarea
                id="create-task-description"
                value={description}
                maxLength={5000}
                disabled={createTask.isPending}
                placeholder="Description"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                className="
                  h-full
                  min-h-[130px]
                  w-full
                  resize-none
                  overflow-y-auto
                  rounded-none
                  border-0
                  bg-transparent
                  px-0
                  py-1
                  text-base
                  leading-6
                  shadow-none
                  outline-none
                  ring-0
                  placeholder:text-muted-foreground
                  focus:border-transparent
                  focus:outline-none
                  focus:ring-0
                  focus-visible:border-transparent
                  focus-visible:outline-none
                  focus-visible:ring-0
                  disabled:opacity-50
                "
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-2.5">
            <TaskStatusPicker value={status} statuses={enabledStatuses} disabled={createTask.isPending} onValueChange={setStatus} />

            <TaskPriorityPicker value={priority} disabled={createTask.isPending} onValueChange={setPriority} />

            <TaskAssigneePicker projectId={projectId} value={assigneeIds} disabled={createTask.isPending} onValueChange={setAssigneeIds} />

            <TaskDatePicker
              label="Start Date"
              value={startDate}
              disabled={createTask.isPending}
              onValueChange={(nextStartDate) => {
                setStartDate(nextStartDate);

                if (dueDate && dueDate < nextStartDate) {
                  setDueDate(null);
                }
              }}
            />

            <TaskDatePicker label="Due Date" value={dueDate} minDate={effectiveStartDate} disabled={createTask.isPending} onValueChange={setDueDate} />
          </div>

          <div className="flex h-9 shrink-0 items-start justify-end gap-2">
            <Button type="button" variant="secondary" size="lg" className="border border-border px-4 shadow-xs" disabled={createTask.isPending} onClick={close}>
              Cancel
            </Button>

            <Button type="submit" size="lg" className="px-4 shadow-xs" disabled={!title.trim() || !dateRangeValid || createTask.isPending}>
              {createTask.isPending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

