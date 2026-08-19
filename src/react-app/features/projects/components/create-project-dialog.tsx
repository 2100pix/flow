import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  canCreatePrivate: boolean;
};

export function CreateProjectDialog({ open, onClose, canCreatePrivate }: CreateProjectDialogProps) {
  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");

  const createProject = useCreateProject();

  if (!open) {
    return null;
  }

  function reset() {
    setName("");
    setDescription("");
    setVisibility("workspace");
    createProject.reset();
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-project-title" className="w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-project-title" className="text-base font-semibold">
              Create project
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">Create a new project inside this workspace.</p>
          </div>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
            <XIcon />
          </Button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            const projectName = name.trim();

            const projectDescription = description.trim();

            if (!projectName || createProject.isPending) {
              return;
            }

            createProject.mutate(
              {
                name: projectName,

                description: projectDescription || undefined,

                visibility: canCreatePrivate ? visibility : "workspace",
              },
              {
                onSuccess: () => {
                  reset();
                  onClose();
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="create-project-name" className="text-sm font-medium">
              Project name
            </label>

            <input
              id="create-project-name"
              value={name}
              maxLength={160}
              autoFocus
              placeholder="Website 2027"
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="create-project-description" className="text-sm font-medium">
              Description
              <span className="ml-1 font-normal text-muted-foreground">optional</span>
            </label>

            <textarea
              id="create-project-description"
              value={description}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              rows={4}
              placeholder="Short project description"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="create-project-visibility" className="text-sm font-medium">
              Project Access
            </label>

            <select
              id="create-project-visibility"
              value={visibility}
              onChange={(event) => {
                setVisibility(event.target.value as "workspace" | "private");
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="workspace">Workspace</option>

              {canCreatePrivate ? <option value="private">Private</option> : null}
            </select>
          </div>

          {createProject.isError ? <p className="text-sm text-destructive">{createProject.error.message}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>

            <Button type="submit" disabled={!name.trim() || createProject.isPending}>
              {createProject.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
