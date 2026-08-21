import { useState } from "react";

import { DotsThreeIcon } from "@phosphor-icons/react";

import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { hasPermission } from "@/features/auth/permissions";

import { useMe } from "@/features/auth/hooks/use-me";

import { useArchiveTask } from "../hooks/use-archive-task";

import { useDeleteTask } from "../hooks/use-delete-task";

import type { TaskDto } from "../types";

type TaskActionsMenuProps = {
  task: TaskDto;

  align?: "start" | "end";

  onArchived?: () => void;

  onDeleted?: () => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function TaskActionsMenu({ task, align = "start", onArchived, onDeleted }: TaskActionsMenuProps) {
  const { data: auth } = useMe();

  const canArchive = hasPermission(auth, "tasks.archive");

  const canDelete = hasPermission(auth, "tasks.delete");

  const archiveTask = useArchiveTask();

  const deleteTask = useDeleteTask();

  const [archiveOpen, setArchiveOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const taskPath = `/projects/${task.projectId}/tasks/${task.id}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Task actions" />}>
          <DotsThreeIcon weight="bold" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} className="w-44">
          <DropdownMenuItem
            onClick={() => {
              window.open(taskPath, "_blank", "noopener,noreferrer");
            }}
          >
            Open in new tab
          </DropdownMenuItem>

          {canArchive ? (
            <DropdownMenuItem
              onClick={() => {
                setArchiveOpen(true);
              }}
            >
              Archive Task
            </DropdownMenuItem>
          ) : null}

          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Delete Task
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive task?</AlertDialogTitle>

            <AlertDialogDescription>
              {task.taskCode} — {task.title} will be removed from the active task workspace. Its data will remain stored.
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
                      setArchiveOpen(false);

                      toast.success("Task archived.");

                      onArchived?.();
                    },

                    onError: (error) => {
                      toast.error(getErrorMessage(error, "Failed to archive task."));
                    },
                  },
                );
              }}
            >
              {archiveTask.isPending ? "Archiving…" : "Archive Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete task?</AlertDialogTitle>

            <AlertDialogDescription>
              {task.taskCode} — {task.title} and its task-owned resources will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              disabled={deleteTask.isPending}
              onClick={() => {
                deleteTask.mutate(
                  {
                    taskId: task.id,

                    projectId: task.projectId,
                  },
                  {
                    onSuccess: () => {
                      setDeleteOpen(false);

                      toast.success("Task permanently deleted.");

                      onDeleted?.();
                    },

                    onError: (error) => {
                      toast.error(getErrorMessage(error, "Failed to delete task."));
                    },
                  },
                );
              }}
            >
              {deleteTask.isPending ? "Deleting…" : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
