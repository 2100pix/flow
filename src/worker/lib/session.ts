export const SESSION_COOKIE = "flow_session";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function createSessionToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export async function hashSessionToken(token: string) {
  const encoded = new TextEncoder().encode(token);

  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}
