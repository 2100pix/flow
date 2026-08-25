import { useState } from "react";

import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { getErrorMessage } from "@/lib/errors";

import { useArchiveProject } from "../hooks/use-archive-project";

import { useDeleteProject } from "../hooks/use-delete-project";

import type { ProjectDto } from "../types";

type ArchiveProjectDialogProps = {
  project: ProjectDto;

  open: boolean;

  onOpenChange: (open: boolean) => void;

  onArchived?: () => void;
};

export function ArchiveProjectDialog({ project, open, onOpenChange, onArchived }: ArchiveProjectDialogProps) {
  const archiveProject = useArchiveProject();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {project.name}?</AlertDialogTitle>

          <AlertDialogDescription>The project will be removed from active navigation. Its members, leads, resources, tasks, workflow, and metadata remain stored.</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveProject.isPending}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            variant="destructive"
            disabled={archiveProject.isPending}
            onClick={() => {
              archiveProject.mutate(project.id, {
                onSuccess: () => {
                  onOpenChange(false);

                  toast.success("Project archived.");

                  onArchived?.();
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to archive project."));
                },
              });
            }}
          >
            {archiveProject.isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteProjectDialogProps = {
  project: ProjectDto;

  open: boolean;

  onOpenChange: (open: boolean) => void;

  onDeleted?: () => void;
};

export function DeleteProjectDialog({ project, open, onOpenChange, onDeleted }: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject();

  const [confirmation, setConfirmation] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setConfirmation("");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete {project.name}?</AlertDialogTitle>

          <AlertDialogDescription>This permanently removes the project, members, project leads, resources, tasks, workflow, and project metadata. There is no restore.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor={`delete-project-confirmation-${project.id}`} className="text-sm font-medium">
            Type <span className="font-semibold">{project.name}</span> to confirm
          </label>

          <input
            id={`delete-project-confirmation-${project.id}`}
            value={confirmation}
            autoComplete="off"
            disabled={deleteProject.isPending}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProject.isPending}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            variant="destructive"
            disabled={confirmation !== project.name || deleteProject.isPending}
            onClick={() => {
              deleteProject.mutate(project.id, {
                onSuccess: () => {
                  handleOpenChange(false);

                  toast.success("Project deleted.");

                  onDeleted?.();
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to delete project."));
                },
              });
            }}
          >
            {deleteProject.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
