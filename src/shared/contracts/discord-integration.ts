export type DiscordIntegrationDto = {
  enabled: boolean;

  connectionStatus: "disconnected" | "connected";

  guild: {
    id: string;
    name: string;
  } | null;

  projectCategoryId: string | null;

  connectedAt: string | null;
};

export type DiscordIntegrationResponse = {
  data: DiscordIntegrationDto;
};
