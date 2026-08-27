import { useMemo, useRef, useState } from "react";
import { move } from "@dnd-kit/helpers";
import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { TaskWorkspaceToolbar, type TaskWorkspaceView } from "@/features/tasks/components/task-workspace-toolbar";
import { TaskBoardView } from "@/features/tasks/components/task-board-view";
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog";

import { useProject } from "@/features/projects/hooks/use-project";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";
import { useProjectTasks } from "@/features/tasks/hooks/use-project-tasks";
import { useReorderTasks } from "@/features/tasks/hooks/use-reorder-tasks";
import { useMe } from "@/features/auth/hooks/use-me";
import { useProjectTaskWorkflow } from "@/features/tasks/hooks/use-project-task-workflow";

import { hasPermission } from "@/features/auth/permissions";

import type { ReorderTasksInput, TaskDto, TaskStatus } from "@/features/tasks/types";

type TaskBoardState = Record<TaskStatus, TaskDto[]>;

function buildBoard(tasks: TaskDto[]) {
  const backlog: TaskDto[] = [];
  const todo: TaskDto[] = [];
  const inProgress: TaskDto[] = [];
  const review: TaskDto[] = [];
  const done: TaskDto[] = [];
  const cancelled: TaskDto[] = [];

  const board = {
    backlog,
    todo,
    in_progress: inProgress,
    review,
    done,
    cancelled,
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
  // SAFETY: entries of a fully-populated TaskBoardState are exactly [TaskStatus, TaskDto[]] pairs, and rebuilding them preserves every key.
  return Object.fromEntries((Object.entries(board) as [TaskStatus, TaskDto[]][]).map(([status, tasks]) => [status, [...tasks]])) as TaskBoardState;
}

function findTaskStatus(board: TaskBoardState, taskId: string): TaskStatus | null {
  // SAFETY: entries of a fully-populated TaskBoardState are exactly [TaskStatus, TaskDto[]] pairs.
  for (const [status, tasks] of Object.entries(board) as [TaskStatus, TaskDto[]][]) {
    if (tasks.some((task) => task.id === taskId)) {
      return status;
    }
  }

  return null;
}

export function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus | null>(null);

  const view: TaskWorkspaceView = searchParams.get("view") === "board" ? "board" : "list";

  const activeTaskId = view === "list" ? searchParams.get("task") : null;
  const requestedStatus = searchParams.get("status");
  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);
  const { data: tasks = [], isPending: tasksPending, isError: tasksError } = useProjectTasks(projectId);
  const { data: workflow, isPending: workflowPending, isError: workflowError } = useProjectTaskWorkflow(projectId);
  const reorderTasks = useReorderTasks();
  const serverBoard = useMemo(() => buildBoard(tasks), [tasks]);
  // SAFETY: serverBoard holds every TaskStatus key, so entries map one-to-one onto a full Record<TaskStatus, number>.
  const stableTaskCounts = useMemo(() => Object.fromEntries((Object.entries(serverBoard) as [TaskStatus, TaskDto[]][]).map(([status, statusTasks]) => [status, statusTasks.length])) as Record<TaskStatus, number>, [serverBoard]);
  const [dragBoard, setDragBoard] = useState<TaskBoardState | null>(null);
  const board = dragBoard ?? serverBoard;
  const boardRef = useRef<TaskBoardState | null>(null);
  const previousBoardRef = useRef<TaskBoardState | null>(null);
  const { data: auth } = useMe();
  const canCreateTask = hasPermission(auth, "tasks.create");
  const canEditTask = hasPermission(auth, "tasks.edit");
  const canAssignTask = hasPermission(auth, "tasks.assign");
  const columns = useMemo(() => (workflow?.statuses ?? []).filter((status) => status.enabled).sort((first, second) => first.position - second.position), [workflow]);
  const activeStatus = columns.find((column) => column.statusKey === requestedStatus)?.statusKey ?? null;
  const visibleColumns = activeStatus ? columns.filter((column) => column.statusKey === activeStatus) : columns;

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
  function openTaskFullscreen(taskId: string) {
    if (!projectId) {
      return;
    }

    void navigate(`/projects/${projectId}/tasks/${taskId}`);
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

  function changeView(nextView: TaskWorkspaceView) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.set("view", nextView);

        if (nextView === "board") {
          next.delete("task");
        }

        return next;
      },
      {
        replace: true,
      },
    );
  }

  function changeStatus(nextStatus: TaskStatus | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (nextStatus) {
          next.set("status", nextStatus);
        } else {
          next.delete("status");
        }

        return next;
      },
      {
        replace: true,
      },
    );
  }

  function openCreateTask(requestedStatus?: TaskStatus | null) {
    const nextStatus = requestedStatus ?? activeStatus ?? columns[0]?.statusKey ?? null;

    if (!nextStatus) {
      return;
    }

    setCreateTaskStatus(nextStatus);
  }

  function closeCreateTask() {
    setCreateTaskStatus(null);
  }

  if (projectPending || tasksPending || workflowPending) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading board…</p>
      </div>
    );
  }

  if (projectError || tasksError || workflowError || !project || !workflow) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">Unable to load board.</p>

          <Link to="/projects" className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        reorderTasks.reset();
        const snapshot = cloneBoard(board);
        previousBoardRef.current = snapshot;
        boardRef.current = snapshot;
      }}
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),

        PointerSensor.configure({
          activationConstraints: (event) => {
            if (event.pointerType === "touch") {
              return [
                new PointerActivationConstraints.Delay({
                  value: 250,
                  tolerance: 5,
                }),
              ];
            }

            return [
              new PointerActivationConstraints.Distance({
                value: 5,
              }),
            ];
          },
        }),
      ]}
      onDragOver={(event) => {
        const source = event.operation.source;

        if (!source || source.type !== "task") {
          return;
        }

        setDragBoard((current) => {
          const base = current ?? boardRef.current ?? board;

          // SAFETY: base is a TaskBoardState and dnd-kit move() only reorders its existing entries, preserving the board shape.
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
        const changed = affectedStatuses.some((status) => {
          const before = snapshot[status];
          const after = currentBoard[status];
          return before.length !== after.length || before.some((task, index) => task.id !== after[index]?.id);
        });

        if (!changed) {
          resetDragState();
          return;
        }

        const input: ReorderTasksInput = {
          columns: affectedStatuses.map((status) => ({
            status,
            taskIds: currentBoard[status].map((task) => task.id),
          })),
        };

        const toastId = toast.loading("Saving task order…");
        reorderTasks.mutate(
          {
            projectId: project.id,
            input,
          },
          {
            onSuccess: () => {
              toast.dismiss(toastId);
            },

            onError: (error) => {
              toast.error(error instanceof Error ? error.message : "Failed to save task order.", {
                id: toastId,
              });
            },

            onSettled: () => {
              resetDragState();
            },
          },
        );
      }}
    >
      <div className="flex h-[calc(100vh-3rem)] min-w-0 overflow-hidden">
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          onPointerDownCapture={() => {
            if (view === "list" && activeTaskId) {
              closeTask();
            }
          }}
        >
          <div className="shrink-0 px-6 pt-6 md:px-8 md:pt-8">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbLink render={<Link to={`/projects/${project.id}`} />} className="max-w-56 truncate sm:max-w-80" title={project.name}>
                    {project.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator />

                <BreadcrumbItem>
                  <BreadcrumbPage>{view === "board" ? "Task Board" : "Task List"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="mt-8">
              <TaskWorkspaceToolbar
                view={view}
                status={activeStatus}
                statuses={columns}
                canCreateTask={canCreateTask}
                onCreateTask={() => {
                  openCreateTask();
                }}
                onViewChange={changeView}
                onStatusChange={changeStatus}
              />
            </div>
          </div>
          <div className="mt-4 min-h-0 flex-1">
            {view === "list" ? (
              <div className="h-full px-6 pb-6 md:px-8 md:pb-8">
                <div className="h-full w-full overflow-y-auto overscroll-contain">
                  <TaskListView
                    projectId={project.id}
                    statuses={visibleColumns}
                    workflowStatuses={columns}
                    board={board}
                    dragDisabled={!canEditTask || reorderTasks.isPending}
                    canEditTask={canEditTask}
                    canAssignTask={canAssignTask}
                    onOpenTask={openTask}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full min-w-0 pb-6 md:pb-8">
                <TaskBoardView taskCounts={stableTaskCounts} statuses={visibleColumns} board={board} dragDisabled={!canEditTask || reorderTasks.isPending} canCreateTask={canCreateTask} onCreateTask={openCreateTask} onOpenTask={openTaskFullscreen} />
              </div>
            )}
          </div>
        </main>
        <TaskDetailSheet taskId={activeTaskId ?? undefined} onClose={closeTask} workflowStatuses={columns} />
        {createTaskStatus ? <CreateTaskDialog open projectId={project.id} statuses={columns} initialStatus={createTaskStatus} onClose={closeCreateTask} /> : null}{" "}
      </div>
    </DragDropProvider>
  );
}
