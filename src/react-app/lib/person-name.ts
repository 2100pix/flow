type PersonNameInput = {
  firstName?: string | null;

  lastName?: string | null;

  displayName: string;
};

export function resolvePersonName({ firstName, lastName, displayName }: PersonNameInput) {
  const normalizedFirstName = firstName?.trim() ?? "";
  const normalizedLastName = lastName?.trim() ?? "";

  if (!normalizedFirstName && !normalizedLastName) {
    return displayName;
  }

  return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
}
