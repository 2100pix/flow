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
import { ProtectedLayout } from "@/features/auth/components/protected-layout";

const ProjectBoardPage = lazy(() =>
  import("@/app/pages/project-board-page").then((module) => ({
    default: module.ProjectBoardPage,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedLayout />,

    children: [
      {
        path: "/",
        element: <HomePage />,
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
        path: "/clients/:clientId",
        element: <ClientDetailPage />,
      },
      {
        path: "/projects/:projectId",
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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
