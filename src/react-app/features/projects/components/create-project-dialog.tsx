import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useClients } from "@/features/clients/hooks/use-clients";
import { ProjectAccessPicker } from "@/features/projects/components/project-access-picker";
import { ProjectClientPicker } from "@/features/projects/components/project-client-picker";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
  canCreatePrivate: boolean;
  canViewClients: boolean;
};

export function CreateProjectDialog({ open, onClose, onCreated, canCreatePrivate, canViewClients }: CreateProjectDialogProps) {
  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");

  const [clientId, setClientId] = useState<string | null>(null);

  const createProject = useCreateProject();

  const { data: clients = [], isPending: clientsPending, isError: clientsError } = useClients(open && canViewClients);

  const activeClients = clients.filter((client) => client.status === "active");

  function reset() {
    setName("");
    setDescription("");
    setVisibility("workspace");
    setClientId(null);

    createProject.reset();
  }

  function close() {
    if (createProject.isPending) {
      return;
    }

    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <DialogContent showCloseButton={!createProject.isPending} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="pr-10 text-lg font-semibold">Create a new project</DialogTitle>
        </DialogHeader>

        <form
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

                clientId,

                visibility: canCreatePrivate ? visibility : "workspace",
              },
              {
                onSuccess: (project) => {
                  reset();

                  toast.success("Project created.");

                  onCreated(project.id);
                },
              },
            );
          }}
        >
          <div className="space-y-2 px-5 pb-4">
            <div>
              <label htmlFor="create-project-name" className="sr-only">
                Project name
              </label>

              <input
                id="create-project-name"
                value={name}
                maxLength={160}
                autoFocus
                disabled={createProject.isPending}
                placeholder="Project name"
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="create-project-description" className="sr-only">
                Description
              </label>

              <textarea
                id="create-project-description"
                value={description}
                maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                rows={4}
                disabled={createProject.isPending}
                placeholder="Description"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                className="min-h-24 w-full resize-none bg-transparent px-0 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
            </div>

            {createProject.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {createProject.error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col gap-3 rounded-none bg-transparent px-5 pb-5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <ProjectAccessPicker value={visibility} onValueChange={setVisibility} canChoosePrivate={canCreatePrivate} disabled={createProject.isPending} />

              <ProjectClientPicker value={clientId} clients={activeClients} onValueChange={setClientId} disabled={!canViewClients || createProject.isPending} loading={clientsPending} error={clientsError} />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button type="button" variant="ghost" disabled={createProject.isPending} onClick={close}>
                Cancel
              </Button>

              <Button type="submit" disabled={!name.trim() || createProject.isPending}>
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
