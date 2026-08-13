import { createBrowserRouter } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { ClientsPage } from "@/app/pages/clients-page";
import { HomePage } from "@/app/pages/home-page";
import { MembersPage } from "@/app/pages/members-page";
import { ProjectsPage } from "@/app/pages/projects-page";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
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
    ],
  },
]);
