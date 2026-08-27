import type { ProjectStatus } from "./projects";
import type { TaskPriority, TaskStatus } from "./tasks";

export type DashboardTaskDto = {
  id: string;
  projectId: string;
  projectName: string;

  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  dueDate: string | null;
};

export type DashboardProjectDto = {
  id: string;
  name: string;

  client: {
    id: string;
    name: string;
  } | null;

  status: ProjectStatus;
  dueDate: string | null;

  progress: number;

  updatedAt: string;
};

export type DashboardResponse = {
  data: {
    counts: {
      activeClients: number;
      activeProjects: number;
      openTasks: number;
      myTasks: number;
    };

    taskStatus: Record<TaskStatus, number>;
    myTasks: DashboardTaskDto[];
    recentProjects: DashboardProjectDto[];
  };
};
