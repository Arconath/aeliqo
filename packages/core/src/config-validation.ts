import type { WorkspaceNode, JsonValue } from "./contracts";

export const safeId = (id: string): boolean =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id) &&
  !["__proto__", "constructor", "prototype"].includes(id);
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function freezeNode(node: WorkspaceNode): WorkspaceNode {
  return Object.freeze({
    ...node,
    ...(node.config
      ? {
          config: freezeConfig(node.config) as Readonly<
            Record<string, JsonValue>
          >,
        }
      : {}),
    ...(node.columns ? { columns: Object.freeze([...node.columns]) } : {}),
    ...(node.compareIds
      ? { compareIds: Object.freeze([...node.compareIds]) }
      : {}),
    ...(node.filters
      ? {
          filters: Object.freeze(
            node.filters.map((filter) =>
              Object.freeze({
                ...filter,
                value: Array.isArray(filter.value)
                  ? Object.freeze([...filter.value])
                  : filter.value,
              }),
            ),
          ),
        }
      : {}),
  });
}
export function freezeConfig(value: JsonValue, depth = 0): JsonValue {
  assert(depth <= 4, "Configuration nesting exceeds limit");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    assert(value.length <= 2000, "Configuration string too long");
    return value;
  }
  if (typeof value === "number") {
    assert(Number.isFinite(value), "Configuration number must be finite");
    return value;
  }
  if (Array.isArray(value)) {
    assert(value.length <= 30, "Configuration array too large");
    return Object.freeze(value.map((item) => freezeConfig(item, depth + 1)));
  }
  assert(
    typeof value === "object" &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
    "Configuration must be plain JSON",
  );
  const entries = Object.entries(value);
  assert(
    entries.length <= 30 && entries.every(([key]) => safeId(key)),
    "Invalid configuration keys",
  );
  return Object.freeze(
    Object.fromEntries(
      entries.map(([key, child]) => [key, freezeConfig(child, depth + 1)]),
    ),
  );
}
