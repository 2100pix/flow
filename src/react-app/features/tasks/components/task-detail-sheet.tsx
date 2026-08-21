import { useState } from "react";

import { XIcon } from "@phosphor-icons/react";

import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import { hasPermission } from "@/features/auth/permissions";

import { useMe } from "@/features/auth/hooks/use-me";

import { TaskDetailContent } from "./task-detail-content";

import { useArchiveTask } from "../hooks/use-archive-task";

import { useTask } from "../hooks/use-task";

import type { TaskWorkflowStatusDto } from "../types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function LoadedTaskDetailSheet({
  taskId,
  onClose,
  workflowStatuses,
}: {
  taskId: string;

  onClose: () => void;

  workflowStatuses: readonly TaskWorkflowStatusDto[];
}) {
  const { data: auth } = useMe();

  const { data: task, isPending, isError } = useTask(taskId);

  const canArchive = hasPermission(auth, "tasks.archive");

  const archiveTask = useArchiveTask();

  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isPending) {
    return <div className="p-6 text-sm text-muted-foreground">Loading task…</div>;
  }

  if (isError || !task) {
    return <div className="p-6 text-sm text-destructive">Unable to load task.</div>;
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TaskDetailContent key={task.id} task={task} workflowStatuses={workflowStatuses} />
        </div>

        {canArchive ? (
          <div className="shrink-0 border-t px-6 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              disabled={archiveTask.isPending}
              onClick={() => {
                setArchiveOpen(true);
              }}
            >
              Archive task
            </Button>
          </div>
        ) : null}
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
    </>
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
      <button type="button" aria-label="Close task details" onClick={onClose} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />

      <aside aria-label="Task details" className="fixed inset-y-0 right-0 z-50 w-full max-w-[540px] border-l bg-background shadow-xl">
        <div className="flex h-14 items-center justify-between border-b px-5">
          <p className="text-sm font-medium">Task details</p>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close task details" onClick={onClose}>
            <XIcon aria-hidden="true" />
          </Button>
        </div>

        <div className="h-[calc(100%-3.5rem)]">
          <LoadedTaskDetailSheet taskId={taskId} onClose={onClose} workflowStatuses={workflowStatuses} />
        </div>
      </aside>
    </>
  );
}
