type EntityPrefix = "ws" | "usr" | "cl" | "prj" | "tsk";

export function createId(prefix: EntityPrefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
