import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { updateWorkspaceSchema, type WorkspaceDto } from "../../shared/contracts/workspace";
import { createDb } from "../db";
import { workspaces } from "../db/schema";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type WorkspaceEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const workspaceRoutes = new Hono<WorkspaceEnv>();

workspaceRoutes.patch(
  "/",
  requireAuth,
  requirePermission("workspace.manage"),
  zValidator("json", updateWorkspaceSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid workspace data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;
    const input = c.req.valid("json");
    const db = createDb(c.env.flow_db);
    const now = new Date();

    await db
      .update(workspaces)
      .set({
        name: input.name,
        updatedAt: now,
      })
      .where(eq(workspaces.id, auth.workspace.id));

    const data: WorkspaceDto = {
      id: auth.workspace.id,
      name: input.name,
      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);
