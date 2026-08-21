import { useMemo, useRef, useState } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { Link, useParams, useSearchParams } from "react-router";

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

function buildBoard(tasks: TaskDto[]): TaskBoardState {
  const board: TaskBoardState = {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
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

export function ProjectBoardPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus | null>(null);
  const activeTaskId = searchParams.get("task");
  const view: TaskWorkspaceView = searchParams.get("view") === "board" ? "board" : "list";
  const requestedStatus = searchParams.get("status") as TaskStatus | null;
  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);
  const { data: tasks = [], isPending: tasksPending, isError: tasksError } = useProjectTasks(projectId);
  const { data: workflow, isPending: workflowPending, isError: workflowError } = useProjectTaskWorkflow(projectId);
  const reorderTasks = useReorderTasks();
  const serverBoard = useMemo(() => buildBoard(tasks), [tasks]);
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
  const activeStatus = requestedStatus && columns.some((column) => column.statusKey === requestedStatus) ? requestedStatus : null;
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
            onSettled: () => {
              resetDragState();
            },
          },
        );
      }}
    >
      <div className="flex h-[calc(100vh-3rem)] min-w-0 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            {" "}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbLink render={<Link to={`/projects/${project.id}`} />} className="max-w-56 truncate sm:max-w-80" title={project.name}>
                    {project.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator />

                <BreadcrumbItem>
                  <BreadcrumbPage>Task List</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="mt-8">
              <TaskWorkspaceToolbar
                view={view}
                onCreateTask={() => {
                  openCreateTask();
                }}
                status={activeStatus}
                statuses={columns}
                canCreateTask={canCreateTask}
                onViewChange={changeView}
                onStatusChange={changeStatus}
              />
            </div>
            {reorderTasks.isPending || reorderTasks.isError ? (
              <div className="mt-2 text-sm" aria-live="polite">
                {reorderTasks.isPending ? <p className="text-muted-foreground">Saving task order…</p> : null}

                {reorderTasks.isError ? <p className="text-destructive">{reorderTasks.error.message}</p> : null}
              </div>
            ) : null}
            <div className="mt-4 min-h-0 flex-1">
              {view === "list" ? (
                <div className="h-full overflow-y-auto overscroll-contain">
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
              ) : (
                <TaskBoardView taskCounts={stableTaskCounts} statuses={visibleColumns} onCreateTask={openCreateTask} board={board} dragDisabled={!canEditTask || reorderTasks.isPending} canCreateTask={canCreateTask} onOpenTask={openTask} />
              )}
            </div>
          </div>
        </main>
        {createTaskStatus ? <CreateTaskDialog open projectId={project.id} statuses={columns} initialStatus={createTaskStatus} onClose={closeCreateTask} /> : null}
        {activeTaskId ? <TaskDetailSheet taskId={activeTaskId} onClose={closeTask} workflowStatuses={columns} /> : null}
      </div>
    </DragDropProvider>
  );
}
