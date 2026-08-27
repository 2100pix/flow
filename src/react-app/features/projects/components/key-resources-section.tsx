import { useState, type FormEvent } from "react";

import { ArrowSquareOutIcon, FileTextIcon, LinkIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCreateProjectResource, useDeleteProjectResource, useProjectResources, useUpdateProjectResource } from "../hooks/use-project-resources";

import { getErrorMessage } from "@/lib/errors";

import type { ProjectResourceDto, ProjectResourceType } from "../types";

type ResourceEditor =
  | {
      mode: "create";
      type: ProjectResourceType;
    }
  | {
      mode: "edit";
      resource: ProjectResourceDto;
    }
  | null;

function getHttpHostname(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.hostname;
  } catch {
    return null;
  }
}

function ResourceSkeleton() {
  return (
    <div className="mt-5 space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function KeyResourcesSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: resources = [], isPending, isError } = useProjectResources(projectId);

  const createResource = useCreateProjectResource();

  const updateResource = useUpdateProjectResource();

  const deleteResource = useDeleteProjectResource();

  const [editor, setEditor] = useState<ResourceEditor>(null);

  const [resourceToDelete, setResourceToDelete] = useState<ProjectResourceDto | null>(null);

  const [title, setTitle] = useState("");

  const [url, setUrl] = useState("");

  const [content, setContent] = useState("");

  const [validationError, setValidationError] = useState<string | null>(null);

  const editorType = editor?.mode === "create" ? editor.type : (editor?.resource.type ?? null);

  const editorPending = createResource.isPending || updateResource.isPending;

  function openCreate(type: ProjectResourceType) {
    setValidationError(null);

    setEditor({
      mode: "create",
      type,
    });

    if (type === "document_brief") {
      setTitle("Project Brief");
      setContent("");
      setUrl("");
      return;
    }

    setTitle("");
    setUrl("");
    setContent("");
  }

  function openEdit(resource: ProjectResourceDto) {
    setValidationError(null);

    setEditor({
      mode: "edit",
      resource,
    });

    setTitle(resource.title ?? "");

    setUrl(resource.url ?? "");

    setContent(resource.content ?? "");
  }

  function closeEditor() {
    if (editorPending) {
      return;
    }

    setEditor(null);
    setValidationError(null);
  }

  function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editor || !editorType) {
      return;
    }

    const nextTitle = title.trim();

    if (editorType === "document_brief") {
      const effectiveTitle = nextTitle || "Project Brief";

      if (editor.mode === "edit" && effectiveTitle === (editor.resource.title ?? "Project Brief") && content === (editor.resource.content ?? "")) {
        closeEditor();
        return;
      }

      if (editor.mode === "create") {
        createResource.mutate(
          {
            projectId,
            input: {
              type: "document_brief",
              title: nextTitle || undefined,
              content,
            },
          },
          {
            onSuccess: () => {
              setEditor(null);

              toast.success("Document brief added.");
            },

            onError: (error) => {
              toast.error(getErrorMessage(error, "Failed to add document brief."));
            },
          },
        );

        return;
      }

      updateResource.mutate(
        {
          projectId,
          resourceId: editor.resource.id,
          input: {
            title: nextTitle || null,
            content,
          },
        },
        {
          onSuccess: () => {
            setEditor(null);

            toast.success("Document brief updated.");
          },

          onError: (error) => {
            toast.error(getErrorMessage(error, "Failed to update document brief."));
          },
        },
      );

      return;
    }

    const nextUrl = url.trim();
    const hostname = getHttpHostname(nextUrl);

    if (!hostname) {
      setValidationError("Use a valid HTTP or HTTPS URL.");

      return;
    }

    setValidationError(null);

    const effectiveTitle = nextTitle || hostname;

    if (editor.mode === "edit" && effectiveTitle === (editor.resource.title ?? hostname) && nextUrl === editor.resource.url) {
      closeEditor();
      return;
    }

    if (editor.mode === "create") {
      createResource.mutate(
        {
          projectId,
          input: {
            type: "link",
            title: nextTitle || undefined,
            url: nextUrl,
          },
        },
        {
          onSuccess: () => {
            setEditor(null);

            toast.success("Link added.");
          },

          onError: (error) => {
            toast.error(getErrorMessage(error, "Failed to add link."));
          },
        },
      );

      return;
    }

    updateResource.mutate(
      {
        projectId,
        resourceId: editor.resource.id,
        input: {
          title: nextTitle || null,
          url: nextUrl,
        },
      },
      {
        onSuccess: () => {
          setEditor(null);

          toast.success("Link updated.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to update link."));
        },
      },
    );
  }

  function confirmDelete() {
    if (!resourceToDelete) {
      return;
    }

    const target = resourceToDelete;

    deleteResource.mutate(
      {
        projectId,
        resourceId: target.id,
      },
      {
        onSuccess: () => {
          setResourceToDelete(null);

          toast.success(target.type === "document_brief" ? "Document brief deleted." : "Link deleted.");
        },

        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to delete resource."));
        },
      },
    );
  }

  return (
    <section className="mt-16 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-medium tracking-tight">Key Resources</h2>

          <p className="mt-1 text-sm text-muted-foreground">Keep the brief and important project links within reach.</p>
        </div>

        {canEdit ? (
          <Tooltip>
            <TooltipTrigger render={<div className="inline-flex" />}>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add key resource" />}>
                  <PlusIcon aria-hidden="true" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      openCreate("document_brief");
                    }}
                  >
                    <FileTextIcon aria-hidden="true" />
                    Document Brief
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      openCreate("link");
                    }}
                  >
                    <LinkIcon aria-hidden="true" />
                    Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>

            <TooltipContent side="top">Add resources</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {isPending ? (
        <ResourceSkeleton />
      ) : isError ? (
        <div className="mt-5 rounded-xl bg-destructive/5 p-5">
          <p className="text-sm text-destructive">Unable to load key resources.</p>
        </div>
      ) : resources.length === 0 ? (
        <div className="mt-5 rounded-xl bg-muted/30 p-7">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium">No key resources yet</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Add a project brief or important external links so the team has a clear starting point.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {resources.map((resource) => (
            <div key={resource.id} className="project-resource-row group/resource flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/40">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {resource.type === "document_brief" ? <FileTextIcon className="size-4" aria-hidden="true" /> : <LinkIcon className="size-4" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resource.title ?? (resource.type === "document_brief" ? "Project Brief" : "Link")}</p>

                {resource.type === "document_brief" ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{resource.content || "No content yet."}</p>
                ) : (
                  <p className="mt-1 truncate text-sm text-muted-foreground" title={resource.url ?? undefined}>
                    {resource.url}
                  </p>
                )}
              </div>
              <div className="project-resource-actions flex shrink-0 items-center gap-1 transition-opacity">
                {" "}
                {resource.type === "link" && resource.url ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${resource.title ?? "link"}`}
                          className="inline-flex size-7 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      }
                    >
                      <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
                    </TooltipTrigger>

                    <TooltipContent side="top">Open link</TooltipContent>
                  </Tooltip>
                ) : null}
                {canEdit ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${resource.title ?? "resource"}`}
                            onClick={() => {
                              openEdit(resource);
                            }}
                          />
                        }
                      >
                        <PencilSimpleIcon aria-hidden="true" />
                      </TooltipTrigger>

                      <TooltipContent side="top">Edit resource</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${resource.title ?? "resource"}`}
                            onClick={() => {
                              setResourceToDelete(resource);
                            }}
                          />
                        }
                      >
                        <TrashIcon aria-hidden="true" />
                      </TooltipTrigger>

                      <TooltipContent side="top">Delete resource</TooltipContent>
                    </Tooltip>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.mode === "edit" ? (editorType === "document_brief" ? "Edit document brief" : "Edit link") : editorType === "document_brief" ? "Add document brief" : "Add link"}</DialogTitle>

            <DialogDescription>{editorType === "document_brief" ? "Keep a concise plain-text brief available from the project overview." : "Add an HTTP or HTTPS link the project team needs frequently."}</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submitEditor}>
            <div>
              <label htmlFor="resource-title" className="text-sm font-medium">
                Title
              </label>

              <input
                id="resource-title"
                value={title}
                disabled={editorPending}
                placeholder={editorType === "document_brief" ? "Project Brief" : "Optional"}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
            </div>

            {editorType === "document_brief" ? (
              <div>
                <label htmlFor="resource-content" className="text-sm font-medium">
                  Content
                </label>

                <textarea
                  id="resource-content"
                  value={content}
                  disabled={editorPending}
                  rows={8}
                  placeholder="Project context, objectives, constraints, or other information the team should have at hand."
                  onChange={(event) => {
                    setContent(event.target.value);
                  }}
                  className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="resource-url" className="text-sm font-medium">
                  URL
                </label>

                <input
                  id="resource-url"
                  type="url"
                  value={url}
                  disabled={editorPending}
                  placeholder="https://example.com"
                  onChange={(event) => {
                    setUrl(event.target.value);

                    if (validationError) {
                      setValidationError(null);
                    }
                  }}
                  className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                />

                {validationError ? <p className="mt-2 text-xs text-destructive">{validationError}</p> : null}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={editorPending} onClick={closeEditor}>
                Cancel
              </Button>

              <Button type="submit" disabled={editorPending}>
                {editorPending ? "Saving..." : editor?.mode === "edit" ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={resourceToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteResource.isPending) {
            setResourceToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete resource</DialogTitle>

            <DialogDescription>
              Remove <strong>{resourceToDelete?.title ?? "this resource"}</strong> from this project.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleteResource.isPending}
              onClick={() => {
                setResourceToDelete(null);
              }}
            >
              Cancel
            </Button>

            <Button type="button" variant="destructive" disabled={deleteResource.isPending} onClick={confirmDelete}>
              {deleteResource.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
