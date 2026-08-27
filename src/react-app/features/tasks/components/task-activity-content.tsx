import { CopyCode } from "@/components/copy-code";
import { TaskActivityLog } from "./task-activity-log";

import type { TaskDto } from "../types";

export function TaskActivityContent({ task }: { task: TaskDto }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col pt-10">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <CopyCode value={task.taskCode} appearance="badge" />
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Activity</h1>

            <div className="mt-4">
              <TaskActivityLog taskId={task.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
