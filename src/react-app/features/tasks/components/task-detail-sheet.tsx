import { ArrowsOutSimpleIcon, SidebarSimpleIcon } from "@phosphor-icons/react";

import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

import { TaskActionsMenu } from "./task-actions-menu";

import { TaskDetailContent } from "./task-detail-content";

import { useTask } from "../hooks/use-task";

import type { TaskWorkflowStatusDto } from "../types";

function LoadedTaskDetailSheet({
  taskId,
  onClose,
  workflowStatuses,
}: {
  taskId: string;

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
  taskId: string;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
}) {
  return (
    <>
      <button type="button" aria-label="Close task details" onClick={onClose} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden" />

      <aside
        aria-label="Task details"
        className="
          fixed inset-y-0 right-0 z-50
          w-full max-w-[540px]
          border-l bg-background shadow-xl

          lg:static lg:inset-auto lg:z-auto
          lg:h-full
          lg:w-[45%]
          lg:min-w-[420px]
          lg:max-w-[640px]
          lg:shrink-0
          lg:shadow-none
        "
      >
        <LoadedTaskDetailSheet taskId={taskId} onClose={onClose} workflowStatuses={workflowStatuses} />
      </aside>
    </>
  );
}
