import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent
        showCloseButton={!createProject.isPending}
        className="
          flex
          h-[430px]
          w-[517px]
          max-h-[calc(100dvh-2rem)]
          max-w-[calc(100vw-2rem)]
          flex-col
          gap-4
          overflow-y-auto
          rounded-[10px]
          p-6
          shadow-lg
          sm:overflow-hidden
          [&>[data-slot=dialog-close]]:right-[18px]
          [&>[data-slot=dialog-close]]:top-6
          [&>[data-slot=dialog-close]]:size-7
          [&>[data-slot=dialog-close]]:bg-transparent
          [&>[data-slot=dialog-close]>svg]:opacity-70
        "
      >
        <DialogHeader className="h-14 shrink-0 gap-2 p-0">
          <DialogTitle className="pr-10 text-lg font-semibold leading-7">Create a new project</DialogTitle>

          <div aria-hidden="true" className="h-5 w-full shrink-0" />
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
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

                onError: (error) => {
                  toast.error(error instanceof Error && error.message ? error.message : "Failed to create project.");
                },
              },
            );
          }}
        >
          <div className="flex h-[210px] shrink-0 flex-col gap-[15px]">
            <div className="h-[35px] shrink-0">
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
                className="
                  h-[35px]
                  w-full
                  rounded-none
                  border-0
                  bg-transparent
                  px-0
                  py-1
                  text-base
                  font-medium
                  shadow-none
                  outline-none
                  ring-0
                  placeholder:font-medium
                  placeholder:text-muted-foreground
                  focus:border-transparent
                  focus:outline-none
                  focus:ring-0
                  focus-visible:border-transparent
                  focus-visible:outline-none
                  focus-visible:ring-0
                  disabled:opacity-50
                "
              />
            </div>

            <div className="h-[160px] shrink-0">
              <label htmlFor="create-project-description" className="sr-only">
                Description
              </label>

              <textarea
                id="create-project-description"
                value={description}
                maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                disabled={createProject.isPending}
                placeholder="Description"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                className="
                  h-[160px]
                  w-full
                  resize-none
                  overflow-hidden
                  rounded-none
                  border-0
                  bg-transparent
                  px-0
                  py-1
                  text-base
                  leading-6
                  shadow-none
                  outline-none
                  ring-0
                  placeholder:text-muted-foreground
                  focus:border-transparent
                  focus:outline-none
                  focus:ring-0
                  focus-visible:border-transparent
                  focus-visible:outline-none
                  focus-visible:ring-0
                  disabled:opacity-50
                "
              />
            </div>
          </div>

          <div className="flex h-8 shrink-0 items-start gap-4">
            <ProjectAccessPicker value={visibility} onValueChange={setVisibility} canChoosePrivate={canCreatePrivate} disabled={createProject.isPending} appearance="create" />

            <ProjectClientPicker value={clientId} clients={activeClients} onValueChange={setClientId} disabled={!canViewClients || createProject.isPending} loading={clientsPending} error={clientsError} />
          </div>

          <div className="flex h-9 shrink-0 items-start justify-end gap-2">
            <Button type="button" variant="secondary" size="lg" className="border border-border px-4 shadow-xs" disabled={createProject.isPending} onClick={close}>
              Cancel
            </Button>

            <Button type="submit" size="lg" className="px-4 shadow-xs" disabled={!name.trim() || createProject.isPending}>
              {createProject.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
