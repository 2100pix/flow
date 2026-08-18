import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeIcon, GearSixIcon, PencilSimpleIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useArchiveProject } from "@/features/projects/hooks/use-archive-project";
import { useUpdateProject } from "@/features/projects/hooks/use-update-project";

import type { ProjectDto } from "@/features/projects/types";

type ProjectActionsMenuProps = {
  project: ProjectDto;
  canEdit: boolean;
  canArchive: boolean;
};

function RenameProjectDialog({ project, onClose }: { project: ProjectDto; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const updateProject = useUpdateProject();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !updateProject.isPending) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, updateProject.isPending]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close rename project"
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!updateProject.isPending) {
            onClose();
          }
        }}
      />

      <div role="dialog" aria-modal="true" aria-labelledby="rename-project-title" className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rename-project-title" className="text-base font-semibold">
              Rename project
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">Change the project name.</p>
          </div>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" disabled={updateProject.isPending} onClick={onClose}>
            <XIcon />
          </Button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            const nextName = name.trim();

            if (!nextName || nextName === project.name) {
              return;
            }

            updateProject.mutate(
              {
                projectId: project.id,
                input: {
                  name: nextName,
                },
              },
              {
                onSuccess: onClose,
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`rename-project-${project.id}`} className="text-sm font-medium">
              Project name
            </label>

            <input
              id={`rename-project-${project.id}`}
              value={name}
              maxLength={160}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {updateProject.isError ? <p className="text-sm text-destructive">{updateProject.error.message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={updateProject.isPending} onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit" disabled={!name.trim() || name.trim() === project.name || updateProject.isPending}>
              {updateProject.isPending ? "Saving…" : "Rename"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function ProjectActionsMenu({ project, canEdit, canArchive }: ProjectActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const archiveProject = useArchiveProject();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const menuWidth = 208;
    const estimatedHeight = 112;

    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth));

    const top = rect.bottom + estimatedHeight + 8 > window.innerHeight ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4;

    setPosition({
      top,
      left,
    });

    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${project.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:text-sidebar-accent-foreground"
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
      >
        <DotsThreeIcon size={16} weight="bold" />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                top: position.top,
                left: position.left,
              }}
              className="fixed z-[70] w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {canEdit ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setOpen(false);
                    setRenameOpen(true);
                  }}
                >
                  <PencilSimpleIcon size={15} />
                  <span>Rename Project</span>
                </button>
              ) : null}

              <Link
                to={`/projects/${project.id}/settings`}
                role="menuitem"
                className="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <GearSixIcon size={15} />
                <span>Project Settings</span>
              </Link>

              {canArchive ? (
                <>
                  <div className="my-1 border-t border-border" />

                  <button
                    type="button"
                    role="menuitem"
                    disabled={archiveProject.isPending}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    onClick={() => {
                      setOpen(false);

                      const confirmed = window.confirm(`Delete ${project.name}? This removes the project from active project views.`);

                      if (!confirmed) {
                        return;
                      }

                      archiveProject.mutate(project.id, {
                        onSuccess: () => {
                          const basePath = `/projects/${project.id}`;

                          if (location.pathname === basePath || location.pathname.startsWith(`${basePath}/`)) {
                            void navigate("/", {
                              replace: true,
                            });
                          }
                        },
                        onError: (error) => {
                          window.alert(error.message);
                        },
                      });
                    }}
                  >
                    <TrashIcon size={15} />
                    <span>{archiveProject.isPending ? "Deleting…" : "Delete Project"}</span>
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {renameOpen ? (
        <RenameProjectDialog
          project={project}
          onClose={() => {
            setRenameOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
