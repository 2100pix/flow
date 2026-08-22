export type DiscordOutboxQueueMessage = {
  outboxEventId: string;

  dispatchAttemptCount: number;
};
