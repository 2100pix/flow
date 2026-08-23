import { useRef } from "react";
import { CalendarBlankIcon, PlusIcon } from "@phosphor-icons/react";

import { DragOverlay, useDragOperation, useDroppable } from "@dnd-kit/react";

import { useSortable } from "@dnd-kit/react/sortable";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";

import type { TaskDto, TaskStatus, TaskWorkflowStatusDto } from "@/features/tasks/types";
import { resolvePersonName } from "@/lib/person-name";

type TaskBoardState = Record<TaskStatus, TaskDto[]>;

type TaskBoardViewProps = {
  statuses: TaskWorkflowStatusDto[];

  board: TaskBoardState;
  taskCounts: Record<TaskStatus, number>;
  dragDisabled: boolean;
  canCreateTask: boolean;

  onOpenTask: (taskId: string) => void;

  onCreateTask?: (status: TaskStatus) => void;
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

function formatTaskDate(value: string | null) {
  const date = parseTaskDate(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
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

function TaskCardAssignees({ task }: { task: TaskDto }) {
  if (task.assignees.length === 0) {
    return null;
  }

  const visible = task.assignees.slice(0, 5);

  const hiddenCount = Math.max(task.assignees.length - visible.length, 0);

  return (
    <AvatarGroup className="-space-x-2">
      {visible.map((assignee) => (
        <Avatar key={assignee.id} size="sm" className="size-[18px]" aria-hidden="true">
          {assignee.avatarUrl ? <AvatarImage src={assignee.avatarUrl} alt="" /> : null}

          <AvatarFallback className="text-[8px]">{getInitials(resolvePersonName({ firstName: assignee.firstName, lastName: assignee.lastName, displayName: assignee.displayName }))}</AvatarFallback>
        </Avatar>
      ))}

      {hiddenCount > 0 ? <AvatarGroupCount className="size-[18px] text-[9px]">+{hiddenCount}</AvatarGroupCount> : null}
    </AvatarGroup>
  );
}

function findBoardTask(board: TaskBoardState, taskId: string) {
  for (const statusTasks of Object.values(board)) {
    const task = statusTasks.find((item) => item.id === taskId);

    if (task) {
      return task;
    }
  }

  return null;
}

function TaskBoardCard({
  task,
  index,
  status,
  dragDisabled,
  onOpen,
}: {
  task: TaskDto;

  index: number;

  status: TaskStatus;

  dragDisabled: boolean;

  onOpen: () => void;
}) {
  const { ref, isDragSource } = useSortable({
    id: task.id,
    index,
    group: status,

    type: "task",
    accept: "task",

    disabled: dragDisabled,
  });

  const pointerOriginRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const pointerMovedRef = useRef(false);

  const dueDate = formatTaskDate(task.dueDate);

  return (
    <button
      ref={ref}
      type="button"
      data-board-card={task.id}
      data-drag-placeholder={isDragSource ? "true" : undefined}
      aria-label={`Open ${task.title}`}
      onPointerDown={(event) => {
        pointerOriginRef.current = {
          x: event.clientX,
          y: event.clientY,
        };

        pointerMovedRef.current = false;
      }}
      onPointerMove={(event) => {
        const origin = pointerOriginRef.current;

        if (!origin) {
          return;
        }

        const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);

        if (distance > 5) {
          pointerMovedRef.current = true;
        }
      }}
      onPointerCancel={() => {
        pointerOriginRef.current = null;

        pointerMovedRef.current = false;
      }}
      onClick={(event) => {
        pointerOriginRef.current = null;

        if (pointerMovedRef.current) {
          event.preventDefault();

          pointerMovedRef.current = false;

          return;
        }

        onOpen();
      }}
      className={[
        "relative flex min-h-[111px] w-full shrink-0 cursor-grab flex-col overflow-hidden rounded-lg border p-4 text-left outline-none",
        "active:cursor-grabbing",
        "transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isDragSource ? "scale-[0.985] border-border/60 bg-card/40 shadow-inner" : "scale-100 border-transparent bg-card shadow-none hover:bg-accent/70",
        dragDisabled ? "cursor-pointer active:cursor-pointer" : "",
      ].join(" ")}
    >
      <div className={["relative z-10 flex min-h-0 flex-1 flex-col justify-between", "transition-[opacity,transform] duration-100 ease-out", isDragSource ? "pointer-events-none translate-y-0.5 opacity-0" : "translate-y-0 opacity-100"].join(" ")}>
        <div>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <span className="min-w-0 truncate text-xs text-muted-foreground">{task.taskCode}</span>

            <TaskCardAssignees task={task} />
          </div>

          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-5">{task.title}</p>
        </div>

        <div className="flex min-w-0 items-center gap-5 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <CalendarBlankIcon aria-hidden="true" className="size-3.5 shrink-0" />

            <span className="truncate">{dueDate ?? "Due date"}</span>
          </div>

          <span className="truncate capitalize">{task.priority ?? "Priority"}</span>
        </div>
      </div>
    </button>
  );
}

function TaskBoardColumn({
  status,
  label,
  tasks,
  dragDisabled,
  canCreateTask,
  count,
  onOpenTask,
  onCreateTask,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskDto[];
  count: number;
  dragDisabled: boolean;
  canCreateTask: boolean;

  onOpenTask: (taskId: string) => void;

  onCreateTask?: (status: TaskStatus) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: status,
    accept: "task",

    collisionPriority: -1,

    disabled: dragDisabled,
  });

  return (
    <section ref={ref} data-board-column="true" className={["group/column flex h-full min-h-0 w-[355px] shrink-0 flex-col overflow-hidden rounded-lg bg-muted/10 px-3.5 py-1.5", isDropTarget ? "ring-2 ring-ring/30" : ""].join(" ")}>
      <header className="flex h-[41px] shrink-0 items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-sm font-medium text-muted-foreground">{label}</h2>

          <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-muted/55 px-1.5 text-xs text-muted-foreground">{count}</span>
        </div>

        <button
          type="button"
          disabled={!canCreateTask || !onCreateTask}
          aria-label={`Create task in ${label}`}
          onClick={() => {
            onCreateTask?.(status);
          }}
          className="flex size-6 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon aria-hidden="true" className="size-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-2">
        {tasks.map((task, index) => (
          <TaskBoardCard
            key={task.id}
            task={task}
            index={index}
            status={status}
            dragDisabled={dragDisabled}
            onOpen={() => {
              onOpenTask(task.id);
            }}
          />
        ))}

        <button
          type="button"
          disabled={!canCreateTask || !onCreateTask}
          onClick={() => {
            onCreateTask?.(status);
          }}
          className={[
            "flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-muted/30 text-xs text-muted-foreground outline-none transition-[background-color,color,opacity]",
            "opacity-0 group-hover/column:opacity-100 group-focus-within/column:opacity-100",
            "bg-card hover:bg-accent/70 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-0 group-hover/column:disabled:opacity-50",
          ].join(" ")}
        >
          <PlusIcon aria-hidden="true" className="size-3.5" />
          New task item
        </button>
      </div>
    </section>
  );
}

export function TaskBoardView({ statuses, board, dragDisabled, canCreateTask, taskCounts, onOpenTask, onCreateTask }: TaskBoardViewProps) {
  const { source } = useDragOperation();
  const overlayTask = source?.type === "task" ? findBoardTask(board, String(source.id)) : null;
  return (
    <div
      data-board-scroll="true"
      className="
      h-full
      min-w-0
      overflow-x-auto
      overflow-y-hidden
      overscroll-x-contain
    "
    >
      <div className="flex h-full min-w-max items-start gap-3 px-6 pb-3 md:px-8">
        {statuses.map((status) => (
          <TaskBoardColumn
            key={status.statusKey}
            count={taskCounts[status.statusKey]}
            status={status.statusKey}
            label={status.label}
            tasks={board[status.statusKey]}
            dragDisabled={dragDisabled}
            canCreateTask={canCreateTask}
            onOpenTask={onOpenTask}
            onCreateTask={onCreateTask}
          />
        ))}
        <DragOverlay dropAnimation={null} className="pointer-events-none z-[100]">
          {overlayTask ? (
            <article
              data-board-drag-overlay="true"
              className="
              flex
              min-h-[92px]
              w-[327px]
              flex-col
              rounded-lg
              border
              border-border/70
              bg-muted
              p-4
              shadow-2xl
              transition-[opacity,transform]
              duration-150
              ease-out
            "
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground">{overlayTask.taskCode}</span>

                  <TaskCardAssignees task={overlayTask} />
                </div>

                <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-5">{overlayTask.title}</p>
              </div>
            </article>
          ) : null}
        </DragOverlay>
      </div>
    </div>
  );
}
