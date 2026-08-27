export type DiscordProfileUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

/** Resolves the Flow display name from a Discord profile (display name first, username fallback). */
export function resolveDiscordDisplayName(user: Pick<DiscordProfileUser, "global_name" | "username">) {
  return user.global_name ?? user.username;
}

/** Builds the Discord CDN avatar URL for a profile, or null when the user has no custom avatar. */
export function getDiscordAvatarUrl(user: DiscordProfileUser) {
  if (!user.avatar) {
    return null;
  }

  const animated = user.avatar.startsWith("a_") ? "&animated=true" : "";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128${animated}`;
}
