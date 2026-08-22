type EntityPrefix = "ws" | "usr" | "cl" | "prj" | "tsk" | "team" | "role" | "res" | "exp";
export function createId(prefix: EntityPrefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
