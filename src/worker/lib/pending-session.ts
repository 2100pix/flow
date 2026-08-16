import { createSessionToken, hashSessionToken } from "./session";

export const PENDING_SESSION_COOKIE = "flow_pending_session";

export const PENDING_SESSION_TTL_SECONDS = 60 * 60;

export function createPendingSessionToken() {
  return createSessionToken();
}

export function hashPendingSessionToken(token: string) {
  return hashSessionToken(token);
}

export function getPendingSessionExpiresAt() {
  return new Date(Date.now() + PENDING_SESSION_TTL_SECONDS * 1000);
}
