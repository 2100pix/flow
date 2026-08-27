import { useState, type FormEvent } from "react";
import { FileTextIcon, LinkIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useCreateTaskResource, useDeleteTaskResource, useTaskResources, useUpdateTaskResource } from "../hooks/use-task-resources";
import { getErrorMessage } from "@/lib/errors";
import type { TaskResourceDto, TaskResourceType } from "../types";

type ResourceEditor =
  | {
      mode: "create";

      type: TaskResourceType;
    }
  | {
      mode: "edit";

      resource: TaskResourceDto;
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

function getResourceTitle(resource: TaskResourceDto) {
  if (resource.title) {
    return resource.title;
  }

  if (resource.type === "document_brief") {
    return "Document Brief";
  }

  if (resource.url) {
    return getHttpHostname(resource.url) ?? "Link";
  }

  return "Link";
}

export function TaskResourcesSection({
  taskId,
  canEdit,
}: {
  taskId: string;

  canEdit: boolean;
}) {
  const { data: resources = [], isPending, isError } = useTaskResources(taskId);

  const createResource = useCreateTaskResource();

  const updateResource = useUpdateTaskResource();

  const deleteResource = useDeleteTaskResource();

  const [editor, setEditor] = useState<ResourceEditor>(null);

  const [resourceToDelete, setResourceToDelete] = useState<TaskResourceDto | null>(null);

  const [title, setTitle] = useState("");

  const [url, setUrl] = useState("");

  const [content, setContent] = useState("");

  const [validationError, setValidationError] = useState<string | null>(null);

  const editorType = editor?.mode === "create" ? editor.type : (editor?.resource.type ?? null);

  const editorPending = createResource.isPending || updateResource.isPending;

  function openCreate(type: TaskResourceType) {
    if (!canEdit) {
      return;
    }

    setValidationError(null);

    setTitle("");

    setUrl("");

    setContent("");

    setEditor({
      mode: "create",
      type,
    });
  }

  function openEdit(resource: TaskResourceDto) {
    setValidationError(null);

    setTitle(resource.title ?? "");

    setUrl(resource.url ?? "");

    setContent(resource.content ?? "");

    setEditor({
      mode: "edit",
      resource,
    });
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

    if (!editor || !editorType || !canEdit) {
      return;
    }

    const nextTitle = title.trim();

    if (editorType === "document_brief") {
      if (editor.mode === "create") {
        createResource.mutate(
          {
            taskId,

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

      const originalTitle = editor.resource.title ?? "";

      const originalContent = editor.resource.content ?? "";

      if (nextTitle === originalTitle && content === originalContent) {
        closeEditor();

        return;
      }

      updateResource.mutate(
        {
          taskId,

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

    if (editor.mode === "create") {
      createResource.mutate(
        {
          taskId,

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

    const originalTitle = editor.resource.title ?? "";

    const originalUrl = editor.resource.url ?? "";

    if (nextTitle === originalTitle && nextUrl === originalUrl) {
      closeEditor();

      return;
    }

    updateResource.mutate(
      {
        taskId,

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
        taskId,

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
    <>
      <section className="mt-6">
        <p className="mb-2 text-xs text-muted-foreground">Resources</p>

        {isPending ? (
          <p className="text-xs text-muted-foreground">Loading resources…</p>
        ) : isError ? (
          <p className="text-xs text-destructive">Unable to load resources.</p>
        ) : (
          <>
            {resources.length > 0 ? (
              <div className="mb-2 space-y-1">
                {resources.map((resource) => (
                  <div key={resource.id} className="group/resource flex min-w-0 items-start gap-2 rounded-lg px-2 py-2 hover:bg-muted/40">
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">{resource.type === "document_brief" ? <FileTextIcon className="size-3.5" aria-hidden="true" /> : <LinkIcon className="size-3.5" aria-hidden="true" />}</div>

                    <div className="min-w-0 flex-1">
                      {resource.type === "document_brief" ? (
                        <button
                          type="button"
                          onClick={() => {
                            openEdit(resource);
                          }}
                          className="block w-full text-left outline-none"
                        >
                          <p className="truncate text-xs font-medium">{getResourceTitle(resource)}</p>

                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{resource.content || "No content yet."}</p>
                        </button>
                      ) : resource.url ? (
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block outline-none">
                          <p className="truncate text-xs font-medium hover:underline">{getResourceTitle(resource)}</p>

                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{resource.url}</p>
                        </a>
                      ) : null}
                    </div>

                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Edit ${getResourceTitle(resource)}`}
                          onClick={() => {
                            openEdit(resource);
                          }}
                        >
                          <PencilSimpleIcon aria-hidden="true" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${getResourceTitle(resource)}`}
                          onClick={() => {
                            setResourceToDelete(resource);
                          }}
                        >
                          <TrashIcon aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" size="xs" className="font-normal" />}>
                  <PlusIcon aria-hidden="true" />
                  Add document or link
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-44">
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
            ) : resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No resources.</p>
            ) : null}
          </>
        )}
      </section>

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "create" ? (editorType === "document_brief" ? "Add Document Brief" : "Add Link") : editorType === "document_brief" ? (canEdit ? "Edit Document Brief" : "Document Brief") : canEdit ? "Edit Link" : "Link"}
            </DialogTitle>

            <DialogDescription>{editorType === "document_brief" ? "Keep task-specific context and instructions close to the work." : "Attach an important external link to this task."}</DialogDescription>
          </DialogHeader>

          {editor ? (
            <form className="space-y-4" onSubmit={submitEditor}>
              <div className="space-y-1.5">
                <label htmlFor="task-resource-title" className="text-xs text-muted-foreground">
                  Title
                </label>

                <input
                  id="task-resource-title"
                  value={title}
                  readOnly={!canEdit}
                  maxLength={240}
                  placeholder={editorType === "document_brief" ? "Document Brief" : "Link title"}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 read-only:opacity-70"
                />
              </div>

              {editorType === "document_brief" ? (
                <div className="space-y-1.5">
                  <label htmlFor="task-resource-content" className="text-xs text-muted-foreground">
                    Content
                  </label>

                  <textarea
                    id="task-resource-content"
                    value={content}
                    readOnly={!canEdit}
                    rows={8}
                    onChange={(event) => {
                      setContent(event.target.value);
                    }}
                    className="min-h-40 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 read-only:opacity-70"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="task-resource-url" className="text-xs text-muted-foreground">
                    URL
                  </label>

                  <input
                    id="task-resource-url"
                    type="url"
                    value={url}
                    readOnly={!canEdit}
                    placeholder="https://example.com"
                    onChange={(event) => {
                      setUrl(event.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 read-only:opacity-70"
                  />

                  {validationError ? <p className="text-xs text-destructive">{validationError}</p> : null}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" disabled={editorPending} onClick={closeEditor}>
                  {canEdit ? "Cancel" : "Close"}
                </Button>

                {canEdit ? (
                  <Button type="submit" disabled={editorPending}>
                    {editorPending ? "Saving…" : "Save"}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(resourceToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setResourceToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>

            <AlertDialogDescription>{resourceToDelete ? `${getResourceTitle(resourceToDelete)} will be permanently removed from this task.` : "This resource will be permanently removed."}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteResource.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction variant="destructive" disabled={deleteResource.isPending} onClick={confirmDelete}>
              {deleteResource.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
