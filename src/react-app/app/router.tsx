import { createBrowserRouter } from "react-router";

import { HomePage } from "@/app/pages/home-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
]);
