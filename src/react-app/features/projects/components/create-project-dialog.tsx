import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useMembers } from "@/features/members/hooks/use-members";
import { PROJECT_DESCRIPTION_MAX_LENGTH } from "@/features/projects/constants";
import { ProjectAccessPicker } from "@/features/projects/components/project-access-picker";
import { ProjectLeadPicker, type ProjectLeadOption } from "@/features/projects/components/project-lead-picker";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";

type CurrentUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
  canCreatePrivate: boolean;
  canViewMembers: boolean;
  currentUser: CurrentUser;
};

export function CreateProjectDialog({ open, onClose, onCreated, canCreatePrivate, canViewMembers, currentUser }: CreateProjectDialogProps) {
  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");

  const [leadUserIds, setLeadUserIds] = useState<string[]>([currentUser.id]);

  const createProject = useCreateProject();

  const { data: workspaceMembers = [], isPending: membersPending, isError: membersError } = useMembers(open && canViewMembers);

  const leadOptions: ProjectLeadOption[] = [
    {
      id: currentUser.id,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
    },

    ...workspaceMembers
      .filter((member) => member.id !== currentUser.id)
      .map((member) => ({
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
      })),
  ];

  function reset() {
    setName("");
    setDescription("");
    setVisibility("workspace");
    setLeadUserIds([currentUser.id]);

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
        <DialogHeader className="px-5 pb-4 pt-5">
          <DialogTitle className="pr-10 text-lg font-semibold">Create a new project</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();

            const projectName = name.trim();

            const projectDescription = description.trim();

            if (!projectName || leadUserIds.length === 0 || createProject.isPending) {
              return;
            }

            createProject.mutate(
              {
                name: projectName,

                description: projectDescription || undefined,

                visibility: canCreatePrivate ? visibility : "workspace",

                leadUserIds,
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
          <div className="space-y-3 px-5 pb-5">
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
                className="min-h-28 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {createProject.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {createProject.error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col gap-3 rounded-none border-t border-border/60 bg-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <ProjectAccessPicker value={visibility} onValueChange={setVisibility} canChoosePrivate={canCreatePrivate} disabled={createProject.isPending} />

              <ProjectLeadPicker options={leadOptions} value={leadUserIds} onValueChange={setLeadUserIds} disabled={createProject.isPending} canBrowseCandidates={canViewMembers} candidatesLoading={membersPending} candidatesError={membersError} />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button type="button" variant="ghost" disabled={createProject.isPending} onClick={close}>
                Cancel
              </Button>

              <Button type="submit" disabled={!name.trim() || leadUserIds.length === 0 || createProject.isPending}>
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
