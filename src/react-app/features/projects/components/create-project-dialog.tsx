import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  canCreatePrivate: boolean;
  canViewClients: boolean;
};

export function CreateProjectDialog({ open, onClose, canCreatePrivate, canViewClients }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const { data: clients = [] } = useClients(open && canViewClients);
  const createProject = useCreateProject();

  if (!open) {
    return null;
  }

  const activeClients = clients.filter((client) => client.status === "active");

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

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        {!canViewClients ? (
          <div className="mt-5 rounded-lg border border-dashed p-4">
            <p className="text-sm text-muted-foreground">Client access is required to create a project.</p>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const projectName = name.trim();
              const projectDescription = description.trim();
              if (!projectName || !clientId) {
                return;
              }

              createProject.mutate(
                {
                  name: projectName,
                  clientId,
                  description: projectDescription || undefined,
                  visibility: canCreatePrivate ? visibility : "workspace",
                },
                {
                  onSuccess: () => {
                    setName("");
                    setDescription("");
                    setClientId("");
                    setVisibility("workspace");
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
                maxLength={5000}
                rows={4}
                placeholder="Short project description"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-project-client" className="text-sm font-medium">
                Client
              </label>

              <select
                id="create-project-client"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select client</option>

                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="create-project-visibility" className="text-sm font-medium">
                Visibility
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

              <p className="text-xs leading-5 text-muted-foreground">
                {visibility === "private" ? "Only project members and authorized private-project roles can access this project." : "Workspace members with project access can discover this project."}
              </p>
            </div>

            {activeClients.length === 0 && <p className="text-sm text-muted-foreground">An active client is required before creating a project.</p>}

            {createProject.isError && <p className="text-sm text-destructive">{createProject.error.message}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>

              <Button type="submit" disabled={!name.trim() || !clientId || createProject.isPending}>
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
