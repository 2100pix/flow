import { eq } from "drizzle-orm";

import { Hono } from "hono";

import type { DiscordIntegrationDto, DiscordIntegrationResponse } from "../../shared/contracts/discord-integration";

import { createDb } from "../db";

import { workspaceDiscordIntegrations } from "../db/schema";

import { requireAuth, requirePermission } from "../middleware/auth";

import type { AppBindings } from "../types/app-env";

import type { AuthContext } from "../types/auth";

type DiscordIntegrationEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const discordIntegrationRoutes = new Hono<DiscordIntegrationEnv>();

discordIntegrationRoutes.get("/", requireAuth, requirePermission("settings.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const [integration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,

      guildName: workspaceDiscordIntegrations.guildName,

      projectCategoryId: workspaceDiscordIntegrations.projectCategoryId,

      connectedAt: workspaceDiscordIntegrations.connectedAt,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  const data: DiscordIntegrationDto = integration
    ? {
        enabled: integration.enabled,

        connectionStatus: integration.guildId ? "connected" : "disconnected",

        guild:
          integration.guildId && integration.guildName
            ? {
                id: integration.guildId,
                name: integration.guildName,
              }
            : null,

        projectCategoryId: integration.projectCategoryId,

        connectedAt: integration.connectedAt?.toISOString() ?? null,
      }
    : {
        enabled: false,

        connectionStatus: "disconnected",

        guild: null,

        projectCategoryId: null,

        connectedAt: null,
      };

  const response: DiscordIntegrationResponse = {
    data,
  };

  return c.json(response);
});
