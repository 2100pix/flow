import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import type { TaskDto, TaskPriority, TaskStatus, UpdateTaskInput } from "../types";

import { useUpdateTask } from "./use-update-task";

const TEXT_SAVE_DELAY_MS = 600;

export type TaskDetailSaveState = "idle" | "saving" | "saved" | "error";

export type TaskDetailDraft = {
  title: string;
  description: string;

  status: TaskStatus;

  priority: TaskPriority | null;

  leadUserId: string | null;

  assigneeIds: string[];

  startDate: string;

  dueDate: string | null;
};

function createDraft(task: TaskDto): TaskDetailDraft {
  return {
    title: task.title,

    description: task.description ?? "",

    status: task.status,

    priority: task.priority,

    leadUserId: task.lead?.id ?? null,

    assigneeIds: task.assignees.map((assignee) => assignee.id),

    startDate: task.startDate,

    dueDate: task.dueDate,
  };
}

function getTaskSaveErrorMessage(error: unknown) {
  return getErrorMessage(error, "Failed to save task.");
}

export function useTaskDetailAutosave(task: TaskDto) {
  const updateTask = useUpdateTask();

  const [draft, setDraft] = useState<TaskDetailDraft>(() => createDraft(task));

  const [saveState, setSaveState] = useState<TaskDetailSaveState>("idle");

  const mountedRef = useRef(true);

  const taskIdRef = useRef(task.id);

  const savedRef = useRef<TaskDetailDraft>(createDraft(task));

  const mutationRef = useRef(updateTask.mutateAsync);

  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingTextRef = useRef<UpdateTaskInput>({});

  useEffect(() => {
    mutationRef.current = updateTask.mutateAsync;
  }, [updateTask.mutateAsync]);

  const enqueue = useCallback((input: UpdateTaskInput) => {
    const taskId = taskIdRef.current;

    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (mountedRef.current) {
          setSaveState("saving");
        }

        try {
          const updated = await mutationRef.current({
            taskId,
            input,
          });

          savedRef.current = createDraft(updated);

          if (mountedRef.current) {
            setSaveState("saved");
          }
        } catch (error) {
          if (mountedRef.current) {
            setSaveState("error");
          }

          toast.error(getTaskSaveErrorMessage(error));

          throw error;
        }
      });

    return chainRef.current;
  }, []);

  const flushText = useCallback(() => {
    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current);

      textTimerRef.current = null;
    }

    const pending = pendingTextRef.current;

    pendingTextRef.current = {};

    if (Object.keys(pending).length === 0) {
      return;
    }

    void enqueue(pending);
  }, [enqueue]);

  const queueText = useCallback(
    (input: UpdateTaskInput) => {
      pendingTextRef.current = {
        ...pendingTextRef.current,
        ...input,
      };

      if (textTimerRef.current) {
        clearTimeout(textTimerRef.current);
      }

      textTimerRef.current = setTimeout(() => {
        textTimerRef.current = null;

        flushText();
      }, TEXT_SAVE_DELAY_MS);
    },
    [flushText],
  );

  const removePendingTextKey = useCallback((key: keyof UpdateTaskInput) => {
    const pending = {
      ...pendingTextRef.current,
    };

    delete pending[key];

    pendingTextRef.current = pending;
  }, []);

  const setTitle = useCallback(
    (value: string) => {
      setDraft((current) => ({
        ...current,
        title: value,
      }));

      const normalized = value.trim();

      if (!normalized) {
        removePendingTextKey("title");

        return;
      }

      queueText({
        title: normalized,
      });
    },
    [queueText, removePendingTextKey],
  );

  const commitTitle = useCallback(() => {
    const normalized = draft.title.trim();

    if (!normalized) {
      removePendingTextKey("title");

      setDraft((current) => ({
        ...current,

        title: savedRef.current.title,
      }));

      return;
    }

    setDraft((current) => ({
      ...current,
      title: normalized,
    }));

    pendingTextRef.current = {
      ...pendingTextRef.current,

      title: normalized,
    };

    flushText();
  }, [draft.title, flushText, removePendingTextKey]);

  const setDescription = useCallback(
    (value: string) => {
      setDraft((current) => ({
        ...current,

        description: value,
      }));

      queueText({
        description: value.trim() || null,
      });
    },
    [queueText],
  );

  const commitDescription = useCallback(() => {
    flushText();
  }, [flushText]);

  const setStatus = useCallback(
    (value: TaskStatus) => {
      setDraft((current) => ({
        ...current,

        status: value,
      }));

      void enqueue({
        status: value,
      });
    },
    [enqueue],
  );

  const setPriority = useCallback(
    (value: TaskPriority | null) => {
      setDraft((current) => ({
        ...current,

        priority: value,
      }));

      void enqueue({
        priority: value,
      });
    },
    [enqueue],
  );

  const setLeadUserId = useCallback(
    (value: string | null) => {
      setDraft((current) => ({
        ...current,

        leadUserId: value,
      }));

      void enqueue({
        leadUserId: value,
      });
    },
    [enqueue],
  );

  const setAssigneeIds = useCallback(
    (value: string[]) => {
      setDraft((current) => ({
        ...current,

        assigneeIds: value,
      }));

      void enqueue({
        assigneeIds: value,
      });
    },
    [enqueue],
  );

  const setStartDate = useCallback(
    (value: string) => {
      const clearsDueDate = Boolean(draft.dueDate && draft.dueDate < value);

      setDraft((current) => ({
        ...current,

        startDate: value,

        dueDate: clearsDueDate ? null : current.dueDate,
      }));

      void enqueue(
        clearsDueDate
          ? {
              startDate: value,

              dueDate: null,
            }
          : {
              startDate: value,
            },
      );
    },
    [draft.dueDate, enqueue],
  );

  const setDueDate = useCallback(
    (value: string | null) => {
      if (value && value < draft.startDate) {
        return;
      }

      setDraft((current) => ({
        ...current,

        dueDate: value,
      }));

      void enqueue({
        dueDate: value,
      });
    },
    [draft.startDate, enqueue],
  );

  const flush = useCallback(() => {
    flushText();

    return chainRef.current;
  }, [flushText]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (textTimerRef.current) {
        clearTimeout(textTimerRef.current);

        textTimerRef.current = null;
      }

      const pending = pendingTextRef.current;

      pendingTextRef.current = {};

      if (Object.keys(pending).length > 0) {
        void enqueue(pending);
      }
    };
  }, [enqueue]);

  return {
    draft,

    saveState,

    isSaving: saveState === "saving",

    setTitle,
    commitTitle,

    setDescription,
    commitDescription,

    setStatus,
    setPriority,

    setLeadUserId,
    setAssigneeIds,

    setStartDate,
    setDueDate,

    flush,
  };
}
