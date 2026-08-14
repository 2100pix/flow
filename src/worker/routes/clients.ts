import { and, asc, eq, isNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createClientSchema, type ClientDto } from "../../shared/contracts/clients";
import { createDb } from "../db";
import { clients } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type ClientsEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const clientsRoutes = new Hono<ClientsEnv>();

clientsRoutes.get("/", requireAuth, async (c) => {
  const auth = c.var.auth;
  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: clients.id,
      name: clients.name,
      logoUrl: clients.logoUrl,
      status: clients.status,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
    })
    .from(clients)
    .where(and(eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));

  const data: ClientDto[] = result.map((client) => ({
    id: client.id,
    name: client.name,
    logoUrl: client.logoUrl,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

clientsRoutes.post(
  "/",
  requireAuth,
  requireRole("owner", "admin"),
  zValidator("json", createClientSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid client data",
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

    const id = createId("cl");
    const now = new Date();

    await db.insert(clients).values({
      id,
      workspaceId: auth.workspace.id,
      name: input.name,
      logoUrl: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const data: ClientDto = {
      id,
      name: input.name,
      logoUrl: null,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return c.json(
      {
        data,
      },
      201,
    );
  },
);
