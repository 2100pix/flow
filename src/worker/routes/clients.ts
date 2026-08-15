import { and, asc, eq, isNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createClientSchema, updateClientSchema, type ClientDto } from "../../shared/contracts/clients";
import { createDb } from "../db";
import { clients, projects } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type ClientsEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const clientsRoutes = new Hono<ClientsEnv>();

clientsRoutes.get("/", requireAuth, requirePermission("clients.view"), async (c) => {
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
  requirePermission("clients.create"),
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

clientsRoutes.get("/:id", requireAuth, requirePermission("clients.view"), async (c) => {
  const auth = c.var.auth;
  const clientId = c.req.param("id");

  const db = createDb(c.env.flow_db);

  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      logoUrl: clients.logoUrl,
      status: clients.status,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
    })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)))
    .limit(1);

  if (!client) {
    return c.json(
      {
        error: {
          code: "CLIENT_NOT_FOUND",
          message: "Client not found",
        },
      },
      404,
    );
  }

  const data: ClientDto = {
    id: client.id,
    name: client.name,
    logoUrl: client.logoUrl,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };

  return c.json({
    data,
  });
});

clientsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("clients.edit"),
  zValidator("json", updateClientSchema, (result, c) => {
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
    const clientId = c.req.param("id");
    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [client] = await db
      .select({
        id: clients.id,
        name: clients.name,
        logoUrl: clients.logoUrl,
        status: clients.status,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)))
      .limit(1);

    if (!client) {
      return c.json(
        {
          error: {
            code: "CLIENT_NOT_FOUND",
            message: "Client not found",
          },
        },
        404,
      );
    }

    const now = new Date();

    await db
      .update(clients)
      .set({
        ...(input.name !== undefined
          ? {
              name: input.name,
            }
          : {}),

        ...(input.status !== undefined
          ? {
              status: input.status,
            }
          : {}),

        updatedAt: now,
      })
      .where(and(eq(clients.id, clientId), eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)));

    const data: ClientDto = {
      id: client.id,
      name: input.name ?? client.name,
      logoUrl: client.logoUrl,
      status: input.status ?? client.status,
      createdAt: client.createdAt.toISOString(),
      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

clientsRoutes.delete("/:id", requireAuth, requirePermission("clients.archive"), async (c) => {
  const auth = c.var.auth;
  const clientId = c.req.param("id");

  const db = createDb(c.env.flow_db);

  const [client] = await db
    .select({
      id: clients.id,
    })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)))
    .limit(1);

  if (!client) {
    return c.json(
      {
        error: {
          code: "CLIENT_NOT_FOUND",
          message: "Client not found",
        },
      },
      404,
    );
  }

  const [existingProject] = await db
    .select({
      id: projects.id,
    })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (existingProject) {
    return c.json(
      {
        error: {
          code: "CLIENT_HAS_PROJECTS",
          message: "Archive the client's projects before archiving this client",
        },
      },
      409,
    );
  }

  const now = new Date();

  await db
    .update(clients)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, auth.workspace.id), isNull(clients.archivedAt)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
