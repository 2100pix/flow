import { Link, useNavigate, useParams } from "react-router";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

import { useProject } from "@/features/projects/hooks/use-project";

import { TaskActionsMenu } from "@/features/tasks/components/task-actions-menu";

import { TaskDetailContent } from "@/features/tasks/components/task-detail-content";

import { useProjectTaskWorkflow } from "@/features/tasks/hooks/use-project-task-workflow";

import { useTask } from "@/features/tasks/hooks/use-task";

function TaskDetailPageSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3rem)] min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 md:px-7 md:pt-8">
        <Skeleton className="h-4 w-72" />

        <div className="mt-8 flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-lg" />

          <Skeleton className="h-6 w-14 rounded-lg" />

          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      </div>

      <div className="min-h-0 flex-1 px-6 py-6 md:px-7">
        <Skeleton className="h-5 w-20 rounded-md" />

        <Skeleton className="mt-3 h-7 w-64" />

        <Skeleton className="mt-3 h-4 w-72" />

        <div className="mt-24">
          <Skeleton className="h-4 w-20" />

          <div className="mt-2 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />

            <Skeleton className="h-8 w-24 rounded-lg" />

            <Skeleton className="h-8 w-20 rounded-lg" />

            <Skeleton className="h-8 w-24 rounded-lg" />

            <Skeleton className="h-8 w-24 rounded-lg" />

            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailPage() {
  const { projectId, taskId } = useParams();

  const navigate = useNavigate();

  const { data: project, isPending: projectPending, isError: projectError } = useProject(projectId);

  const { data: task, isPending: taskPending, isError: taskError } = useTask(taskId);

  const { data: workflow, isPending: workflowPending, isError: workflowError } = useProjectTaskWorkflow(projectId);

  if (!projectId || !taskId) {
    return null;
  }

  if (projectPending || taskPending || workflowPending) {
    return <TaskDetailPageSkeleton />;
  }

  if (projectError || taskError || workflowError || !project || !task || !workflow || task.projectId !== project.id) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-destructive">Unable to load task.</p>

        <Link to={`/projects/${projectId}/board?view=list`} className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
          Back to Task List
        </Link>
      </div>
    );
  }

  const taskListPath = `/projects/${project.id}/board?view=list`;

  function returnToTaskList() {
    void navigate(taskListPath, {
      replace: true,
    });
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] min-w-0 flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-6 md:px-7 md:pt-8">
        <div className="flex min-w-0 items-center gap-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbLink render={<Link to={`/projects/${project.id}`} />} className="max-w-40 truncate sm:max-w-56" title={project.name}>
                  {project.name}
                </BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to={`/projects/${project.id}/board?view=list`} />}>Task List</BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem className="min-w-0">
                <span className="max-w-40 truncate text-muted-foreground sm:max-w-56" title={task.title}>
                  {task.title}
                </span>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbPage>Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <TaskActionsMenu task={task} align="start" onArchived={returnToTaskList} onDeleted={returnToTaskList} />
        </div>

        <nav aria-label="Task detail sections" className="mt-8 flex items-center gap-1.5">
          <Button type="button" variant="secondary" size="xs" aria-current="page">
            Overview
          </Button>

          <Button type="button" variant="ghost" size="xs" disabled title="Coming soon" className="disabled:opacity-60">
            Activity
          </Button>

          <Button type="button" variant="ghost" size="xs" disabled title="Coming soon" className="disabled:opacity-60">
            Updates
          </Button>
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <TaskDetailContent key={task.id} task={task} workflowStatuses={workflow.statuses} />
      </main>
    </div>
  );
}
