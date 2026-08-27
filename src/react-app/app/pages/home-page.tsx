import { Link } from "react-router";

import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { useMe } from "@/features/auth/hooks/use-me";

import { hasPermission } from "@/features/auth/permissions";

const taskStatuses = [
  {
    key: "backlog",
    label: "Backlog",
  },
  {
    key: "todo",
    label: "Ready",
  },
  {
    key: "in_progress",
    label: "Progress",
  },
  {
    key: "review",
    label: "In review",
  },
  {
    key: "done",
    label: "Complete",
  },
  {
    key: "cancelled",
    label: "Cancelled",
  },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function HomePage() {
  const { data: auth } = useMe();
  const canView = hasPermission(auth, "dashboard.view");
  const { data, isPending, isError } = useDashboard(canView);

  if (auth && !canView) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You do not have access to the dashboard.</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">Unable to load dashboard.</p>
      </div>
    );
  }

  const totalTasks = Object.values(data.taskStatus).reduce((sum, value) => sum + value, 0);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of current workspace activity.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active clients" value={data.counts.activeClients} />
          <StatCard label="Active projects" value={data.counts.activeProjects} />

          <StatCard label="Open tasks" value={data.counts.openTasks} />

          <StatCard label="My tasks" value={data.counts.myTasks} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="rounded-lg border">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-medium">My tasks</h2>

              <p className="mt-1 text-xs text-muted-foreground">Open tasks assigned to you.</p>
            </div>

            {data.myTasks.length > 0 ? (
              <div className="divide-y">
                {data.myTasks.map((task) => (
                  <Link key={task.id} to={`/projects/${task.projectId}/board?task=${task.id}`} className="flex items-center justify-between gap-6 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>

                      <p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs capitalize text-muted-foreground">{task.status.replace("_", " ")}</p>

                      {task.dueDate ? <p className="mt-1 text-xs text-muted-foreground">{formatDate(task.dueDate)}</p> : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">No open tasks assigned to you.</p>
            )}
          </section>

          <section className="rounded-lg border p-5">
            <div>
              <h2 className="text-sm font-medium">Task status</h2>
              <p className="mt-1 text-xs text-muted-foreground">Current non-archived project work.</p>
            </div>

            <div className="mt-5 space-y-4">
              {taskStatuses.map((status) => {
                const count = data.taskStatus[status.key];

                const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;

                return (
                  <div key={status.key}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">{status.label}</span>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="rounded-lg border">
          <div className="flex items-center justify-between gap-6 border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-medium">Recent projects</h2>
              <p className="mt-1 text-xs text-muted-foreground">Recently updated active work.</p>
            </div>

            <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>

          {data.recentProjects.length > 0 ? (
            <div className="divide-y">
              {data.recentProjects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`} className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_140px_180px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{project.client?.name ?? "Not set"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm capitalize">{project.status.replace("_", " ")}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Progress</span>
                      <span className="text-xs text-muted-foreground">{project.progress}%</span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">No active projects.</p>
          )}
        </section>
      </div>
    </div>
  );
}
