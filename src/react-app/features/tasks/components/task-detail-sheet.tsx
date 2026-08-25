import type { CSSProperties } from "react";

import { ArrowsOutSimpleIcon, SidebarSimpleIcon } from "@phosphor-icons/react";

import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { TaskActionsMenu } from "./task-actions-menu";

import { TaskDetailContent } from "./task-detail-content";

import { useTask } from "../hooks/use-task";

import type { TaskWorkflowStatusDto } from "../types";

function LoadedTaskDetailSheet({
  taskId,
  onClose,
  workflowStatuses,
}: {
  taskId: string | undefined;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
}) {
  const navigate = useNavigate();

  const { data: task, isPending, isError } = useTask(taskId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 px-3">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide task details" title="Hide sheet" onClick={onClose}>
          <SidebarSimpleIcon aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open task fullscreen"
          title="Fullscreen"
          disabled={!task}
          onClick={() => {
            if (!task) {
              return;
            }

            void navigate(`/projects/${task.projectId}/tasks/${task.id}`);
          }}
        >
          <ArrowsOutSimpleIcon aria-hidden="true" />
        </Button>

        {task ? <TaskActionsMenu task={task} align="start" onArchived={onClose} onDeleted={onClose} /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isPending ? <div className="p-6 text-sm text-muted-foreground">Loading task…</div> : null}

        {isError ? <div className="p-6 text-sm text-destructive">Unable to load task.</div> : null}

        {task ? <TaskDetailContent key={task.id} task={task} workflowStatuses={workflowStatuses} /> : null}
      </div>
    </div>
  );
}

export function TaskDetailSheet({
  taskId,
  onClose,
  workflowStatuses,
}: {
  taskId: string | undefined;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
}) {
  const open = Boolean(taskId);

  return (
    <>
      <button type="button" aria-label="Close task details" onClick={onClose} className={cn("fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]", "transition-opacity duration-150 lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} />

      <aside
        aria-label="Task details"
        aria-hidden={!open}
        inert={!open}
        style={
          // SAFETY: React's CSSProperties type predates CSS custom property support; "--task-detail-sheet-width" is a valid inline style key at runtime.
          {
            "--task-detail-sheet-width": open ? "clamp(420px, 45%, 640px)" : "0px",
          } as CSSProperties
        }
        className={cn(
          "fixed inset-y-0 right-0 z-50",
          "w-full max-w-[540px]",
          "overflow-hidden border-l bg-background shadow-xl",
          "transition-[transform,opacity] duration-200 ease-out",

          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0",

          "lg:static lg:inset-auto lg:z-auto",
          "lg:h-full lg:max-w-none",
          "lg:translate-x-0 lg:opacity-100",
          "lg:shrink-0 lg:shadow-none",
          "lg:w-[var(--task-detail-sheet-width)]",
          "lg:transition-[width] lg:duration-200 lg:ease-out",

          open ? "lg:border-l" : "lg:border-l-0",
        )}
      >
        <div className={cn("h-full w-full", "transition-opacity duration-150", "lg:min-w-[420px]", open ? "opacity-100" : "opacity-0")}>
          <LoadedTaskDetailSheet taskId={taskId} onClose={onClose} workflowStatuses={workflowStatuses} />
        </div>
      </aside>
    </>
  );
}
