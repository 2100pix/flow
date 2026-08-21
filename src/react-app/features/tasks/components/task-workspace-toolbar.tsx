import { DotsThreeIcon, ListIcon, PlusIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TaskWorkspaceFilterButton, TaskWorkspaceFilterGroup } from "./task-workspace-filter";

import type { TaskStatus } from "@/features/tasks/types";
import type { TaskWorkflowStatusDto } from "../../../../shared/contracts/task-workflow";

export type TaskWorkspaceView = "list" | "board";

type TaskWorkspaceToolbarProps = {
  view: TaskWorkspaceView;
  status: TaskStatus | null;
  statuses: TaskWorkflowStatusDto[];

  canCreateTask: boolean;
  onCreateTask: () => void;
  onViewChange: (view: TaskWorkspaceView) => void;

  onStatusChange: (status: TaskStatus | null) => void;
};

export function TaskWorkspaceToolbar({ view, status, statuses, canCreateTask, onViewChange, onStatusChange, onCreateTask }: TaskWorkspaceToolbarProps) {
  const enabledStatuses = [...statuses].filter((item) => item.enabled).sort((first, second) => first.position - second.position);

  const primaryStatuses = enabledStatuses.slice(0, 2);

  const moreStatuses = enabledStatuses.slice(2);

  const moreActive = moreStatuses.some((item) => item.statusKey === status);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <TaskWorkspaceFilterGroup>
        <TaskWorkspaceFilterButton
          active={status === null}
          onClick={() => {
            onStatusChange(null);
          }}
        >
          All project
        </TaskWorkspaceFilterButton>

        {primaryStatuses.map((item) => (
          <TaskWorkspaceFilterButton
            key={item.statusKey}
            active={status === item.statusKey}
            onClick={() => {
              onStatusChange(item.statusKey);
            }}
          >
            {item.label}
          </TaskWorkspaceFilterButton>
        ))}

        {moreStatuses.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="icon-xs" aria-label="More task status filters" className={cn("rounded-lg text-muted-foreground", moreActive && "bg-foreground/20 text-foreground hover:bg-foreground/25")} />}
            >
              <DotsThreeIcon weight="bold" aria-hidden="true" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>

                <DropdownMenuRadioGroup
                  value={status ?? ""}
                  onValueChange={(nextValue) => {
                    const nextStatus = moreStatuses.find((item) => item.statusKey === nextValue);

                    if (!nextStatus) {
                      return;
                    }

                    onStatusChange(nextStatus.statusKey);
                  }}
                >
                  {moreStatuses.map((item) => (
                    <DropdownMenuRadioItem key={item.statusKey} value={item.statusKey}>
                      {item.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TaskWorkspaceFilterGroup>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 items-center rounded-lg bg-muted p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => {
              onViewChange("list");
            }}
            className={cn("h-6 rounded-md px-2 text-sm text-muted-foreground hover:bg-transparent", view === "list" && "bg-foreground/20 text-foreground hover:bg-foreground/20")}
          >
            <ListIcon aria-hidden="true" />
            List
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={view === "board"}
            onClick={() => {
              onViewChange("board");
            }}
            className={cn("h-6 rounded-md px-2 text-sm text-muted-foreground hover:bg-transparent", view === "board" && "bg-foreground/20 text-foreground hover:bg-foreground/20")}
          >
            <SquaresFourIcon aria-hidden="true" />
            Board
          </Button>
        </div>

        <Button type="button" variant="secondary" size="sm" disabled={!canCreateTask} onClick={onCreateTask} className="h-7 gap-1.5">
          <PlusIcon aria-hidden="true" />
          New task
        </Button>
      </div>
    </div>
  );
}
