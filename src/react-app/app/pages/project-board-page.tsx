import { useState } from "react";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useProject } from "@/features/projects/hooks/use-project";
import { useCreateTask } from "@/features/tasks/hooks/use-create-task";
import { useProjectTasks } from "@/features/tasks/hooks/use-project-tasks";
import type { TaskDto, TaskStatus } from "@/features/tasks/types";

const columns: {
  status: TaskStatus;
  label: string;
}[] = [
  {
    status: "backlog",
    label: "Backlog",
  },
  {
    status: "todo",
    label: "To do",
  },
  {
    status: "in_progress",
    label: "In progress",
  },
  {
    status: "review",
    label: "Review",
  },
  {
    status: "done",
    label: "Done",
  },
];

function QuickCreateTask({ projectId, status }: { projectId: string; status: TaskStatus }) {
  const [title, setTitle] = useState("");

  const createTask = useCreateTask();

  return (
    <form
      className="border-t p-2"
      onSubmit={(event) => {
        event.preventDefault();

        const value = title.trim();

        if (!value) {
          return;
        }

        createTask.mutate(
          {
            projectId,

            input: {
              title: value,
              status,
            },
          },
          {
            onSuccess: () => {
              setTitle("");
            },
          },
        );
      }}
    >
      <div className="flex gap-1.5">
        <input
          value={title}
          maxLength={240}
          placeholder="Add task"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
        />

        <Button type="submit" size="sm" disabled={!title.trim() || createTask.isPending}>
          Add
        </Button>
      </div>

      {createTask.isError ? <p className="mt-2 text-xs text-destructive">{createTask.error.message}</p> : null}
    </form>
  );
}

function TaskCard({ task }: { task: TaskDto }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm font-medium leading-5">{task.title}</p>

      {task.assignee ? (
        <div className="mt-3 flex items-center gap-2">
          {task.assignee.avatarUrl ? <img src={task.assignee.avatarUrl} alt="" className="size-5 rounded-full" /> : null}

          <span className="truncate text-xs text-muted-foreground">{task.assignee.displayName}</span>
        </div>
      ) : null}
    </div>
  );
}

function TaskColumn({ projectId, status, label, tasks }: { projectId: string; status: TaskStatus; label: string; tasks: TaskDto[] }) {
  return (
    <section className="flex w-[290px] shrink-0 flex-col rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">{label}</h2>

        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      <div className="min-h-28 flex-1 space-y-2 p-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <QuickCreateTask projectId={projectId} status={status} />
    </section>
  );
}

export function ProjectBoardPage() {
  const { projectId } = useParams();

  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);

  const { data: tasks = [], isPending: tasksPending, isError: tasksError } = useProjectTasks(projectId);

  if (!projectId) {
    return null;
  }

  if (projectPending || tasksPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading board…</div>;
  }

  if (projectError || tasksError || !project) {
    return <div className="p-8 text-sm text-destructive">Unable to load board.</div>;
  }

  return (
    <div className="flex h-screen min-w-0 flex-col">
      <div className="shrink-0 border-b px-8 py-5">
        <Link to={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          Project overview
        </Link>

        <div className="mt-2">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>

          <p className="mt-1 text-sm text-muted-foreground">{project.client.name}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full min-w-max gap-3">
          {columns.map((column) => (
            <TaskColumn key={column.status} projectId={project.id} status={column.status} label={column.label} tasks={tasks.filter((task) => task.status === column.status)} />
          ))}
        </div>
      </div>
    </div>
  );
}
