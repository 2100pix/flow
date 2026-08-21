import { useState } from "react";

import { ArrowsOutSimpleIcon, DotsThreeIcon, SidebarSimpleIcon } from "@phosphor-icons/react";

import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 px-3">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide task details" title="Hide sheet" onClick={onClose}>
            <SidebarSimpleIcon aria-hidden="true" />
          </Button>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Open task fullscreen" title="Fullscreen" disabled className="disabled:opacity-100">
            <ArrowsOutSimpleIcon aria-hidden="true" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Task actions" />}>
              <DotsThreeIcon weight="bold" aria-hidden="true" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-44">
              {task && canArchive ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setArchiveOpen(true);
                  }}
                >
                  Archive Task
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isPending ? <div className="p-6 text-sm text-muted-foreground">Loading task…</div> : null}

          {isError ? <div className="p-6 text-sm text-destructive">Unable to load task.</div> : null}

          {task ? <TaskDetailContent key={task.id} task={task} workflowStatuses={workflowStatuses} /> : null}
        </div>
      </div>

      {task ? (
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
      ) : null}
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
