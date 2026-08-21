import { Link, useNavigate, useParams } from "react-router";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

import { Skeleton } from "@/components/ui/skeleton";

import { useProject } from "@/features/projects/hooks/use-project";

import { TaskActionsMenu } from "@/features/tasks/components/task-actions-menu";

import { TaskDetailContent } from "@/features/tasks/components/task-detail-content";
import { TaskWorkspaceFilterButton, TaskWorkspaceFilterGroup } from "@/features/tasks/components/task-workspace-filter";
import { useProjectTaskWorkflow } from "@/features/tasks/hooks/use-project-task-workflow";

import { useTask } from "@/features/tasks/hooks/use-task";

function TaskDetailPageSkeleton() {
  return (
    <div className="p-6 md:p-8">
      <Skeleton className="h-5 w-72" />
      <div className="mt-8 flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-lg" />

        <Skeleton className="h-6 w-14 rounded-lg" />

        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="pt-10">
          <div className="max-w-2xl">
            <Skeleton className="h-6 w-20 rounded-md" />

            <Skeleton className="mt-3 h-9 w-80 max-w-full" />

            <Skeleton className="mt-4 h-5 w-full max-w-xl" />
          </div>

          <div className="mt-24 max-w-2xl">
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
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-destructive">Unable to load task.</p>

          <Link to={`/projects/${projectId}/board?view=list`} className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
            Back to Task List
          </Link>
        </div>
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
    <div className="p-6 md:p-8">
      <div className="relative w-fit max-w-[calc(100%-2rem)]">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink render={<Link to={`/projects/${project.id}`} />} className="max-w-56 truncate sm:max-w-80" title={project.name}>
                {project.name}
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to={`/projects/${project.id}/board?view=list`} />}>Task List</BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem className="min-w-0">
              <span className="max-w-56 truncate text-muted-foreground sm:max-w-80" title={task.title}>
                {task.title}
              </span>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbPage>Overview</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="absolute left-full top-1/2 ml-1 -translate-y-1/2">
          <TaskActionsMenu task={task} align="start" onArchived={returnToTaskList} onDeleted={returnToTaskList} />
        </div>
      </div>

      <div className="mt-8">
        <div className="mt-8">
          <nav aria-label="Task detail sections">
            <TaskWorkspaceFilterGroup>
              <TaskWorkspaceFilterButton active ariaCurrent="page">
                Overview
              </TaskWorkspaceFilterButton>

              <TaskWorkspaceFilterButton active={false}>Activity</TaskWorkspaceFilterButton>

              <TaskWorkspaceFilterButton active={false}>Updates</TaskWorkspaceFilterButton>
            </TaskWorkspaceFilterGroup>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <TaskDetailContent key={task.id} task={task} workflowStatuses={workflow.statuses} presentation="page" />
      </div>
    </div>
  );
}
