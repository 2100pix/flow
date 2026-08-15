import { Hono } from "hono";

import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { clientsRoutes } from "./routes/clients";
import { projectsRoutes } from "./routes/projects";
import { membersRoutes } from "./routes/members";
import { tasksRoutes } from "./routes/tasks";
import { dashboardRoutes } from "./routes/dashboard";
import { workspaceRoutes } from "./routes/workspace";
import { teamsRoutes } from "./routes/teams";
import { rolesRoutes } from "./routes/roles";
import { HTTPException } from "hono/http-exception";

import type { AppBindings } from "./types/app-env";

const app = new Hono<{
  Bindings: AppBindings;
}>();

app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/clients", clientsRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/members", membersRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/workspace", workspaceRoutes);
app.route("/api/teams", teamsRoutes);
app.route("/api/roles", rolesRoutes);

app.route("/api", tasksRoutes);

app.get("/api/health", (c) => {
  return c.json({
    data: {
      status: "ok",
      service: "flow",
    },
  });
});

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "API route not found",
      },
    },
    404,
  );
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: "HTTP_ERROR",

          message: error.message || "Request failed",
        },
      },
      error.status,
    );
  }

  console.error("Unhandled Flow API error", error);

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",

        message: "Internal server error",
      },
    },
    500,
  );
});

export default app;
