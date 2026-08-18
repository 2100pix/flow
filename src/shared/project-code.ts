export function deriveProjectCode(name: string) {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return normalized.slice(0, 4) || "PRJT";
}

export function resolveProjectCode(name: string, override: string | null) {
  return override ?? deriveProjectCode(name);
}
