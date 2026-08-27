import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format-date";
import { useTaskActivity } from "../hooks/use-task-activity";
import { DotIcon, ArrowRightIcon } from "@phosphor-icons/react";

import type { TaskActivityDto } from "../types";

/*
 * Helper relative time ("2h ago")
 * render di sisi kanan tiap activity.
 */
function formatRelativeTime(value: string): string {
  const deltaSeconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (deltaSeconds < 45) {
    return "Just now";
  }

  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (deltaSeconds < hour) {
    return `${Math.round(deltaSeconds / minute)}m ago`;
  }

  if (deltaSeconds < day) {
    return `${Math.round(deltaSeconds / hour)}h ago`;
  }

  return `${Math.round(deltaSeconds / day)}d ago`;
}

type ActivityRender = {
  verb: string;

  change?: ReactNode;
};

function renderActivity(activity: TaskActivityDto): ActivityRender {
  const metadata = activity.metadata;

  switch (activity.eventType) {
    case "TASK_CREATED":
      return {
        verb: "created this task",
      };

    case "STATUS_CHANGED":
      return metadata && "before" in metadata
        ? {
            verb: "changed status",

            change: (
              <>
                {metadata.before ?? "—"} <ArrowRightIcon size={12} className="mx-1 inline text-muted-foreground" aria-hidden="true" /> {metadata.after ?? "—"}
              </>
            ),
          }
        : { verb: "changed status" };

    case "PRIORITY_CHANGED":
      return metadata && "before" in metadata
        ? {
            verb: "changed priority",

            change: (
              <>
                {metadata.before ?? "—"} <ArrowRightIcon size={12} className="mx-1 inline text-muted-foreground" aria-hidden="true" /> {metadata.after ?? "—"}
              </>
            ),
          }
        : { verb: "changed priority" };

    case "ASSIGNEE_ADDED":
      return metadata && "userName" in metadata
        ? {
            verb: `assigned ${metadata.userName}`,
          }
        : { verb: "assigned a member" };

    case "ASSIGNEE_REMOVED":
      return metadata && "userName" in metadata
        ? {
            verb: `unassigned ${metadata.userName}`,
          }
        : { verb: "unassigned a member" };

    case "LEAD_CHANGED":
      return metadata && "before" in metadata
        ? {
            verb: "changed lead",

            change: (
              <>
                {metadata.before ?? "—"} <ArrowRightIcon size={12} className="mx-1 inline text-muted-foreground" aria-hidden="true" /> {metadata.after ?? "—"}
              </>
            ),
          }
        : { verb: "changed lead" };

    case "START_DATE_CHANGED":
      return metadata && "before" in metadata
        ? {
            verb: "changed start date",

            change: (
              <>
                {formatDate(metadata.before) ?? "—"} <ArrowRightIcon size={12} className="mx-1 inline text-muted-foreground" aria-hidden="true" /> {formatDate(metadata.after) ?? "—"}
              </>
            ),
          }
        : { verb: "changed start date" };

    case "DUE_DATE_CHANGED":
      return metadata && "before" in metadata
        ? {
            verb: "changed due date",

            change: (
              <>
                {formatDate(metadata.before) ?? "—"} <ArrowRightIcon size={12} className="mx-1 inline text-muted-foreground" aria-hidden="true" /> {formatDate(metadata.after) ?? "—"}
              </>
            ),
          }
        : { verb: "changed due date" };

    case "DESCRIPTION_CHANGED":
      return {
        verb: "changed description",
      };

    case "RESOURCE_ADDED":
      return metadata && "title" in metadata && metadata.title
        ? {
            verb: "added a resource",

            change: metadata.title,
          }
        : { verb: "added a resource" };
  }
}

function TaskActivityRow({ activity }: { activity: TaskActivityDto }) {
  const { verb, change } = renderActivity(activity);

  return (
    <li className="flex  gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <div className="text-sm text-foreground flex row gap-1">
            <div>
              <span className="font-medium">{activity.actor.displayName}</span> <span className="text-muted-foreground">{verb}</span>
            </div>
            <DotIcon size={16} />
            <span className="flex self-center shrink-0 text-xs text-muted-foreground">{formatRelativeTime(activity.createdAt)}</span>
          </div>

          {change ? <p className="mt-0.5 text-sm text-muted-foreground">{change}</p> : null}
        </div>
      </div>
    </li>
  );
}

export function TaskActivityLog({ taskId }: { taskId: string }) {
  const { data, isPending, isError, isFetchingNextPage, hasNextPage, fetchNextPage } = useTaskActivity(taskId);
  const activities = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      {isPending ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : isError ? (
        <p className="p-4 text-sm text-destructive">Unable to load activity.</p>
      ) : activities.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="flex max-h-[60vh] flex-col">
          <ul className="divide-y divide-border/60 overflow-y-auto px-4">
            {activities.map((activity) => (
              <TaskActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>

          {hasNextPage ? (
            <div className="border-t border-border/60 p-3">
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {isFetchingNextPage ? "Loading…" : "Load older"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
