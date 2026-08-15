import { useMemo, useRef, useState } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Link, useParams, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useProject } from "@/features/projects/hooks/use-project";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";
import { useCreateTask } from "@/features/tasks/hooks/use-create-task";
import { useProjectTasks } from "@/features/tasks/hooks/use-project-tasks";
import { useReorderTasks } from "@/features/tasks/hooks/use-reorder-tasks";
import { useMe } from "@/features/auth/hooks/use-me";
import { useProjectTaskWorkflow } from "@/features/tasks/hooks/use-project-task-workflow";

import { hasPermission } from "@/features/auth/permissions";

import type { ReorderTasksInput, TaskDto, TaskStatus } from "@/features/tasks/types";

type TaskBoardState = Record<TaskStatus, TaskDto[]>;

function buildBoard(tasks: TaskDto[]): TaskBoardState {
  const board: TaskBoardState = {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };

  for (const task of tasks) {
    board[task.status].push(task);
  }

  for (const columnTasks of Object.values(board)) {
    columnTasks.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return board;
}

function cloneBoard(board: TaskBoardState): TaskBoardState {
  return Object.fromEntries((Object.entries(board) as [TaskStatus, TaskDto[]][]).map(([status, tasks]) => [status, [...tasks]])) as TaskBoardState;
}

function findTaskStatus(board: TaskBoardState, taskId: string): TaskStatus | null {
  for (const [status, tasks] of Object.entries(board) as [TaskStatus, TaskDto[]][]) {
    if (tasks.some((task) => task.id === taskId)) {
      return status;
    }
  }

  return null;
}

function QuickCreateTask({ projectId, status, disabled }: { projectId: string; status: TaskStatus; disabled: boolean }) {
  const [title, setTitle] = useState("");

  const createTask = useCreateTask();

  return (
    <form
      className="border-t p-2"
      onSubmit={(event) => {
        event.preventDefault();

        const value = title.trim();

        if (!value || disabled) {
          return;
        }

        createTask.mutate(
          {
            projectId,

            input: {
              title: value,
              status,
            },
          },
          {
            onSuccess: () => {
              setTitle("");
            },
          },
        );
      }}
    >
      <div className="flex gap-1.5">
        <input
          value={title}
          maxLength={240}
          disabled={disabled || createTask.isPending}
          placeholder="Add task"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
        />

        <Button type="submit" size="sm" disabled={disabled || !title.trim() || createTask.isPending}>
          Add
        </Button>
      </div>

      {createTask.isError ? <p className="mt-2 text-xs text-destructive">{createTask.error.message}</p> : null}
    </form>
  );
}

function TaskCard({ task, index, status, dragDisabled, onOpen }: { task: TaskDto; index: number; status: TaskStatus; dragDisabled: boolean; onOpen: () => void }) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: task.id,
    index,
    group: status,

    type: "task",
    accept: "task",

    disabled: dragDisabled,
  });

  return (
    <div ref={ref} className={`rounded-lg border bg-background p-3 transition-opacity ${isDragSource ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium leading-5">{task.title}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.priority && <span className="capitalize">{task.priority}</span>}

            {task.dueDate && <span>{task.dueDate}</span>}
          </div>

          {task.assignee && (
            <div className="mt-3 flex items-center gap-2">
              {task.assignee.avatarUrl && <img src={task.assignee.avatarUrl} alt="" className="size-5 rounded-full" />}

              <span className="truncate text-xs text-muted-foreground">{task.assignee.displayName}</span>
            </div>
          )}
        </button>

        <button
          ref={handleRef}
          type="button"
          disabled={dragDisabled}
          aria-label={`Drag ${task.title}`}
          className="shrink-0 cursor-grab rounded-md px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40 active:cursor-grabbing"
        >
          Drag
        </button>
      </div>
    </div>
  );
}

function TaskColumn({
  projectId,
  status,
  label,
  tasks,
  dragDisabled,
  canCreateTask,
  onOpenTask,
}: {
  projectId: string;
  status: TaskStatus;
  label: string;
  tasks: TaskDto[];
  dragDisabled: boolean;
  canCreateTask: boolean;

  onOpenTask: (taskId: string) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: status,
    accept: "task",

    collisionPriority: -1,

    disabled: dragDisabled,
  });

  return (
    <section ref={ref} className={`flex w-[290px] shrink-0 flex-col rounded-lg border bg-muted/20 ${isDropTarget ? "ring-1 ring-ring" : ""}`}>
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">{label}</h2>

        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      <div className="min-h-28 flex-1 space-y-2 p-2">
        {tasks.map((task, index) => (
          <TaskCard
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
      </div>

      {canCreateTask && <QuickCreateTask projectId={projectId} status={status} disabled={false} />}
    </section>
  );
}

export function ProjectBoardPage() {
  const { projectId } = useParams();

  const [searchParams, setSearchParams] = useSearchParams();

  const activeTaskId = searchParams.get("task");

  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);

  const { data: tasks = [], isPending: tasksPending, isError: tasksError } = useProjectTasks(projectId);
  const { data: workflow, isPending: workflowPending, isError: workflowError } = useProjectTaskWorkflow(projectId);

  const reorderTasks = useReorderTasks();

  const serverBoard = useMemo(() => buildBoard(tasks), [tasks]);

  const [dragBoard, setDragBoard] = useState<TaskBoardState | null>(null);

  const board = dragBoard ?? serverBoard;

  const boardRef = useRef<TaskBoardState | null>(null);

  const previousBoardRef = useRef<TaskBoardState | null>(null);
  const { data: auth } = useMe();

  const canCreateTask = hasPermission(auth, "tasks.create");

  const canEditTask = hasPermission(auth, "tasks.edit");

  const columns = useMemo(() => workflow?.statuses.filter((status) => status.enabled) ?? [], [workflow]);

  if (!projectId) {
    return null;
  }

  function resetDragState() {
    boardRef.current = null;

    previousBoardRef.current = null;

    setDragBoard(null);
  }

  function openTask(taskId: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      next.set("task", taskId);

      return next;
    });
  }

  function closeTask() {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete("task");

        return next;
      },
      {
        replace: true,
      },
    );
  }

  if (projectPending || tasksPending || workflowPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading board…</div>;
  }

  if (projectError || tasksError || workflowError || !project || !workflow) {
    return <div className="p-8 text-sm text-destructive">Unable to load board.</div>;
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        const snapshot = cloneBoard(board);

        previousBoardRef.current = snapshot;

        boardRef.current = snapshot;
      }}
      onDragOver={(event) => {
        const source = event.operation.source;

        if (!source || source.type !== "task") {
          return;
        }

        setDragBoard((current) => {
          const base = current ?? boardRef.current ?? board;

          const next = move(base, event) as TaskBoardState;

          boardRef.current = next;

          return next;
        });
      }}
      onDragEnd={(event) => {
        const snapshot = previousBoardRef.current;

        const currentBoard = boardRef.current;

        if (!snapshot || !currentBoard) {
          resetDragState();
          return;
        }

        if (event.canceled || !event.operation.target) {
          resetDragState();
          return;
        }

        const source = event.operation.source;

        if (!source || source.type !== "task") {
          resetDragState();
          return;
        }

        const taskId = String(source.id);

        const sourceStatus = findTaskStatus(snapshot, taskId);

        const targetStatus = findTaskStatus(currentBoard, taskId);

        if (!sourceStatus || !targetStatus) {
          resetDragState();
          return;
        }

        const affectedStatuses: TaskStatus[] = sourceStatus === targetStatus ? [sourceStatus] : [sourceStatus, targetStatus];

        const input: ReorderTasksInput = {
          columns: affectedStatuses.map((status) => ({
            status,

            taskIds: currentBoard[status].map((task) => task.id),
          })),
        };

        reorderTasks.mutate(
          {
            projectId: project.id,

            input,
          },
          {
            onSuccess: () => {
              resetDragState();
            },

            onError: () => {
              resetDragState();
            },
          },
        );
      }}
    >
      <div className="flex h-screen min-w-0 flex-col">
        <div className="shrink-0 border-b px-8 py-5">
          <Link to={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Project overview
          </Link>

          <div className="mt-2">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>

            <p className="mt-1 text-sm text-muted-foreground">{project.client.name}</p>

            {reorderTasks.isError ? <p className="mt-2 text-sm text-destructive">Unable to save task order.</p> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex h-full min-w-max gap-3">
            {columns.map((column) => (
              <TaskColumn
                key={column.statusKey}
                projectId={project.id}
                status={column.statusKey}
                label={column.label}
                tasks={board[column.statusKey]}
                dragDisabled={!canEditTask || reorderTasks.isPending}
                canCreateTask={canCreateTask}
                onOpenTask={openTask}
              />
            ))}
          </div>
        </div>
        {activeTaskId ? <TaskDetailSheet taskId={activeTaskId} onClose={closeTask} workflowStatuses={workflow.statuses} /> : null}
      </div>
    </DragDropProvider>
  );
}
