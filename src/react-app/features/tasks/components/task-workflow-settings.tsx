import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";

import { useProjectTaskWorkflow } from "../hooks/use-project-task-workflow";

import { useUpdateProjectTaskWorkflow } from "../hooks/use-update-project-task-workflow";

import type { TaskWorkflowStatusDto } from "../types";

type TaskWorkflowSettingsProps = {
  projectId: string;
  canManage: boolean;
};

type TaskWorkflowEditorProps = {
  projectId: string;
  initialStatuses: readonly TaskWorkflowStatusDto[];
  canManage: boolean;
};

function TaskWorkflowEditor({ projectId, initialStatuses, canManage }: TaskWorkflowEditorProps) {
  const [statuses, setStatuses] = useState<TaskWorkflowStatusDto[]>(
    initialStatuses.map((status) => ({
      ...status,
    })),
  );

  const updateWorkflow = useUpdateProjectTaskWorkflow();

  const normalizedLabels = statuses.map((status) => status.label.trim().toLowerCase());

  const hasInvalidLabel = statuses.some((status) => {
    const label = status.label.trim();

    return label.length < 1 || label.length > 40;
  });

  const hasDuplicateLabel = new Set(normalizedLabels).size !== normalizedLabels.length;

  const isDirty = statuses.some((status, index) => {
    const initial = initialStatuses[index];

    return !initial || status.statusKey !== initial.statusKey || status.label !== initial.label || status.enabled !== initial.enabled;
  });

  const canSave = canManage && isDirty && !hasInvalidLabel && !hasDuplicateLabel && !updateWorkflow.isPending;

  function moveStatus(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= statuses.length) {
      return;
    }

    setStatuses((current) => {
      const next = [...current];

      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];

      return next.map((status, position) => ({
        ...status,
        position,
      }));
    });
  }

  return (
    <div className="rounded-lg border p-5">
      <div>
        <p className="text-sm font-medium">Task workflow</p>

        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Rename, reorder, and enable project task statuses. Backlog and Done are required.</p>
      </div>

      <div className="mt-5 divide-y rounded-lg border">
        {statuses.map((status, index) => {
          const required = status.statusKey === "backlog" || status.statusKey === "done";

          return (
            <div key={status.statusKey} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
              <div>
                <input
                  value={status.label}
                  maxLength={40}
                  disabled={!canManage}
                  onChange={(event) => {
                    const label = event.target.value;

                    setStatuses((current) =>
                      current.map((item) =>
                        item.statusKey === status.statusKey
                          ? {
                              ...item,
                              label,
                            }
                          : item,
                      ),
                    );
                  }}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
                />

                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{status.statusKey}</p>
              </div>

              <label className="flex h-8 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status.enabled}
                  disabled={!canManage || required}
                  onChange={(event) => {
                    const enabled = event.target.checked;

                    setStatuses((current) =>
                      current.map((item) =>
                        item.statusKey === status.statusKey
                          ? {
                              ...item,
                              enabled,
                            }
                          : item,
                      ),
                    );
                  }}
                />

                {required ? "Required" : "Enabled"}
              </label>

              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canManage || index === 0}
                  onClick={() => {
                    moveStatus(index, -1);
                  }}
                >
                  ↑
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canManage || index === statuses.length - 1}
                  onClick={() => {
                    moveStatus(index, 1);
                  }}
                >
                  ↓
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {hasDuplicateLabel ? <p className="mt-3 text-sm text-destructive">Status labels must be unique.</p> : null}

      {canManage ? (
        <Button
          className="mt-4"
          disabled={!canSave}
          onClick={() => {
            updateWorkflow.mutate(
              {
                projectId,

                input: {
                  statuses: statuses.map((status) => ({
                    statusKey: status.statusKey,

                    label: status.label.trim(),

                    enabled: status.enabled,
                  })),
                },
              },
              {
                onSuccess: () => {
                  toast.success("Workflow updated.");
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to update workflow."));
                },
              },
            );
          }}
        >
          {updateWorkflow.isPending ? "Saving…" : "Save workflow"}
        </Button>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">You have read-only access to this workflow.</p>
      )}
    </div>
  );
}

export function TaskWorkflowSettings({ projectId, canManage }: TaskWorkflowSettingsProps) {
  const { data: workflow, isPending, isError } = useProjectTaskWorkflow(projectId);

  const editorKey = useMemo(() => workflow?.statuses.map((status) => [status.statusKey, status.label, status.position, status.enabled].join(":")).join("|") ?? "", [workflow]);

  if (isPending) {
    return <div className="rounded-lg border p-5 text-sm text-muted-foreground">Loading task workflow…</div>;
  }

  if (isError || !workflow) {
    return <div className="rounded-lg border p-5 text-sm text-destructive">Unable to load task workflow.</div>;
  }

  return <TaskWorkflowEditor key={editorKey} projectId={projectId} initialStatuses={workflow.statuses} canManage={canManage} />;
}
