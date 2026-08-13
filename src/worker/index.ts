import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({
    data: {
      status: "ok",
      service: "flow",
    },
  });
});

export default app;
