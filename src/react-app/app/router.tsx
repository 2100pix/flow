import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";

import { ClientDetailPage } from "@/app/pages/client-detail-page";
import { ClientsPage } from "@/app/pages/clients-page";
import { HomePage } from "@/app/pages/home-page";
import { LoginPage } from "@/app/pages/login-page";
import { MembersPage } from "@/app/pages/members-page";
import { NotFoundPage } from "@/app/pages/not-found-page";
import { ProjectDetailPage } from "@/app/pages/project-detail-page";

import { ProjectsPage } from "@/app/pages/projects-page";
import { AccessPendingPage } from "@/app/pages/access-pending-page";
import { MyProjectsPage } from "@/app/pages/my-projects-page";
import { ProjectOverviewPage } from "@/app/pages/project-overview-page";

import { ProtectedLayout } from "@/features/auth/components/protected-layout";

const ProjectBoardPage = lazy(() =>
  import("@/app/pages/project-board-page").then((module) => ({
    default: module.ProjectBoardPage,
  })),
);

const TaskDetailPage = lazy(() =>
  import("@/app/pages/task-detail-page").then((module) => ({
    default: module.TaskDetailPage,
  })),
);

const SettingsPage = lazy(() =>
  import("@/app/pages/settings-page").then((module) => ({
    default: module.SettingsPage,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/access-pending",
    element: <AccessPendingPage />,
  },
  {
    element: <ProtectedLayout />,

    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/my-projects",
        element: <MyProjectsPage />,
      },
      {
        path: "/clients",
        element: <ClientsPage />,
      },
      {
        path: "/projects",
        element: <ProjectsPage />,
      },
      {
        path: "/members",
        element: <MembersPage />,
      },
      {
        path: "/settings",
        element: (
          <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: "/clients/:clientId",
        element: <ClientDetailPage />,
      },
      {
        path: "/projects/:projectId",
        element: <ProjectOverviewPage />,
      },
      {
        path: "/projects/:projectId/settings",
        element: <ProjectDetailPage />,
      },
      {
        path: "/projects/:projectId/board",

        element: (
          <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
            <ProjectBoardPage />
          </Suspense>
        ),
      },
      {
        path: "/projects/:projectId/tasks/:taskId",

        element: (
          <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
            <TaskDetailPage />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
