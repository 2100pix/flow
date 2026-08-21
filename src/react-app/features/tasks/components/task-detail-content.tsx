import { useMemo, useState } from "react";

import { CalendarBlankIcon, CheckIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

import { Calendar } from "@/components/ui/calendar";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";

import { hasPermission } from "@/features/auth/permissions";

import { useMe } from "@/features/auth/hooks/use-me";

import { useProjectMembers } from "@/features/members/hooks/use-project-members";

import type { ProjectMemberDto } from "@/features/members/types";

import { useTaskDetailAutosave } from "../hooks/use-task-detail-autosave";

import type { TaskDto, TaskPriority, TaskStatus, TaskWorkflowStatusDto } from "../types";

type TaskDetailContentProps = {
  task: TaskDto;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
};

const NO_PRIORITY = "__flow_no_priority__";

const NO_LEAD = "__flow_no_lead__";

const priorityLabels: Record<TaskPriority, string> = {
  urgent: "Urgent",
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
};

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

function formatTaskTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sortProjectMembers(projectMembers: readonly ProjectMemberDto[]) {
  return [...projectMembers].sort((first, second) => {
    const addedOrder = first.addedAt.localeCompare(second.addedAt);

    if (addedOrder !== 0) {
      return addedOrder;
    }

    return first.user.id.localeCompare(second.user.id);
  });
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
      <PopoverTrigger disabled={disabled} render={<Button type="button" variant="outline" className="h-8 w-auto justify-start gap-1.5 rounded-lg px-2.5 text-xs font-normal" />}>
        <CalendarBlankIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />

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

function TaskLeadControl({
  task,
  members,
  value,
  disabled,
  onValueChange,
}: {
  task: TaskDto;

  members: readonly ProjectMemberDto[];

  value: string | null;

  disabled: boolean;

  onValueChange: (userId: string | null) => void;
}) {
  const selectedMember = members.find((member) => member.user.id === value);

  const currentTaskLead = task.lead?.id === value ? task.lead : null;

  const selectedName = selectedMember?.user.displayName ?? currentTaskLead?.displayName ?? null;

  return (
    <Select
      value={value ?? NO_LEAD}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue === NO_LEAD) {
          onValueChange(null);

          return;
        }

        const member = members.find((item) => item.user.id === nextValue);

        if (!member) {
          return;
        }

        onValueChange(member.user.id);
      }}
    >
      <SelectTrigger className="h-8 w-auto min-w-0 rounded-lg px-2.5 text-xs">{selectedName ?? "Lead"}</SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Lead</SelectLabel>

          <SelectSeparator />

          <SelectItem value={NO_LEAD}>No lead</SelectItem>

          <SelectSeparator />

          {members.map((member) => (
            <SelectItem key={member.user.id} value={member.user.id}>
              {member.user.displayName}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TaskAssigneeControl({
  members,
  value,
  disabled,
  onValueChange,
}: {
  members: readonly ProjectMemberDto[];

  value: string[];

  disabled: boolean;

  onValueChange: (userIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(value);

  const label = value.length === 0 ? "Assignees" : value.length === 1 ? "1 Assignee" : `${value.length} Assignees`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disabled} render={<Button type="button" variant="outline" className="h-8 w-auto justify-start gap-1.5 rounded-lg px-2.5 text-xs font-normal" />}>
        {label}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1 text-sm font-medium">Assignees</p>

        <div className="my-1 h-px bg-border" />

        {members.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No project members.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {members.map((member) => {
              const selected = selectedSet.has(member.user.id);

              return (
                <button
                  key={member.user.id}
                  type="button"
                  onClick={() => {
                    onValueChange(selected ? value.filter((userId) => userId !== member.user.id) : [...value, member.user.id]);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
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

export function TaskDetailContent({ task, workflowStatuses }: TaskDetailContentProps) {
  const { data: auth } = useMe();

  const canEdit = hasPermission(auth, "tasks.edit");

  const canAssign = hasPermission(auth, "tasks.assign");

  const { data: projectMembers = [], isPending: membersPending, isError: membersError } = useProjectMembers(task.projectId, canAssign);

  const orderedMembers = useMemo(() => sortProjectMembers(projectMembers), [projectMembers]);

  const autosave = useTaskDetailAutosave(task);

  const editableWorkflowStatuses = useMemo(
    () => workflowStatuses.filter((workflowStatus) => workflowStatus.enabled || workflowStatus.statusKey === autosave.draft.status).sort((first, second) => first.position - second.position),
    [autosave.draft.status, workflowStatuses],
  );

  const activeStatus = editableWorkflowStatuses.find((workflowStatus) => workflowStatus.statusKey === autosave.draft.status) ?? null;

  const priorityLabel = autosave.draft.priority ? priorityLabels[autosave.draft.priority] : "None";

  return (
    <div className="flex min-h-full flex-col">
      <div className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col px-6 py-6 md:px-7">
          <div>
            <p className="inline-flex rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{task.taskCode}</p>

            <label htmlFor={`task-title-${task.id}`} className="sr-only">
              Task title
            </label>

            <input
              id={`task-title-${task.id}`}
              value={autosave.draft.title}
              disabled={!canEdit}
              maxLength={240}
              onChange={(event) => {
                autosave.setTitle(event.target.value);
              }}
              onBlur={() => {
                autosave.commitTitle();
              }}
              className="mt-3 w-full border-0 bg-transparent p-0 text-xl font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground disabled:opacity-100"
            />

            <label htmlFor={`task-description-${task.id}`} className="sr-only">
              Task description
            </label>

            <textarea
              id={`task-description-${task.id}`}
              value={autosave.draft.description}
              disabled={!canEdit}
              rows={2}
              maxLength={5000}
              placeholder="Add a description"
              onChange={(event) => {
                autosave.setDescription(event.target.value);
              }}
              onBlur={() => {
                autosave.commitDescription();
              }}
              className="mt-3 min-h-10 w-full resize-none border-0 bg-transparent p-0 text-xs leading-5 text-muted-foreground outline-none placeholder:text-muted-foreground disabled:opacity-100"
            />

            <span className="sr-only" aria-live="polite">
              {autosave.saveState === "saving" ? "Saving task" : autosave.saveState === "saved" ? "Task saved" : autosave.saveState === "error" ? "Task save failed" : ""}
            </span>
          </div>

          <div className="mt-24">
            <p className="mb-2 text-xs text-muted-foreground">Properties</p>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={autosave.draft.status}
                disabled={!canEdit}
                onValueChange={(value) => {
                  const nextStatus = editableWorkflowStatuses.find((workflowStatus) => workflowStatus.statusKey === value);

                  if (!nextStatus) {
                    return;
                  }

                  autosave.setStatus(nextStatus.statusKey as TaskStatus);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-lg px-2.5 text-xs">{activeStatus?.label ?? "Status"}</SelectTrigger>

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

              <Select
                value={autosave.draft.priority ?? NO_PRIORITY}
                disabled={!canEdit}
                onValueChange={(value) => {
                  if (value === NO_PRIORITY) {
                    autosave.setPriority(null);

                    return;
                  }

                  if (value === "urgent" || value === "low" || value === "medium" || value === "high") {
                    autosave.setPriority(value);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-lg px-2.5 text-xs">{priorityLabel}</SelectTrigger>

                <SelectContent align="start" alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectLabel>Priority</SelectLabel>

                    <SelectSeparator />

                    <SelectItem value={NO_PRIORITY}>None</SelectItem>

                    <SelectItem value="urgent">Urgent</SelectItem>

                    <SelectItem value="low">Low Priority</SelectItem>

                    <SelectItem value="medium">Medium Priority</SelectItem>

                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <TaskLeadControl
                task={task}
                members={orderedMembers}
                value={autosave.draft.leadUserId}
                disabled={!canAssign || membersPending || membersError}
                onValueChange={(userId) => {
                  autosave.setLeadUserId(userId);
                }}
              />

              <TaskAssigneeControl
                members={orderedMembers}
                value={autosave.draft.assigneeIds}
                disabled={!canAssign || membersPending || membersError}
                onValueChange={(userIds) => {
                  autosave.setAssigneeIds(userIds);
                }}
              />

              <TaskDateControl
                label="Start Date"
                value={autosave.draft.startDate}
                canClear={false}
                disabled={!canEdit}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }

                  autosave.setStartDate(value);
                }}
              />

              <TaskDateControl
                label="Due Date"
                value={autosave.draft.dueDate}
                minimum={autosave.draft.startDate}
                canClear
                disabled={!canEdit}
                onValueChange={(value) => {
                  autosave.setDueDate(value);
                }}
              />
            </div>
          </div>

          <div className="mt-auto flex justify-end pt-16">
            <div className="space-y-1 text-right text-[10px] text-muted-foreground">
              <p>Created on {formatTaskTimestamp(task.createdAt)}</p>

              <p>Updated on {formatTaskTimestamp(task.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
