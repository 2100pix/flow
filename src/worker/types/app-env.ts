import type { DiscordOutboxQueueMessage } from "./discord-queue";

export type AppBindings = Env & {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;

  DISCORD_BOT_TOKEN: string;
  DISCORD_INTEGRATION_REDIRECT_URI: string;
  FLOW_BOOTSTRAP_OWNER_DISCORD_USER_ID: string;
  FLOW_WORKSPACE_ID: string;

  FLOW_DISCORD_QUEUE: Queue<DiscordOutboxQueueMessage>;
};
