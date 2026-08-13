import { Hono } from "hono";

const app = new Hono();

const routes = app.get("/api/health", (c) => {
  return c.json({
    data: {
      status: "ok",
      service: "flow",
    },
  });
});

export type AppType = typeof routes;

export default app;
