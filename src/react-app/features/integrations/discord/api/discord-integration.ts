import { apiFetch } from "@/lib/api";

import type { DiscordIntegrationResponse } from "../types";

export async function getDiscordIntegration() {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord");

  return response.data;
}
