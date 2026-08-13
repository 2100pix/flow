import { Hono } from "hono";

import { createDb } from "./db";
import { workspaces } from "./db/schema";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  return c.json({
    data: {
      status: "ok",
      service: "flow",
    },
  });
});

app.get("/api/db-health", async (c) => {
  const db = createDb(c.env.flow_db);

  await db
    .select({
      id: workspaces.id,
    })
    .from(workspaces)
    .limit(1);

  return c.json({
    data: {
      status: "ok",
      database: "d1",
    },
  });
});

export default app;
