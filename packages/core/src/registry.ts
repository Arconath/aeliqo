import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Capability, DataPort, WorkspaceNode } from "./model";

export const deltaConfigSchema = z.object({ baseline: z.number().finite().nullable(), baselineLabel: z.string().trim().min(1).max(160), mode: z.enum(["absolute", "relative"]).optional() }).strict();

export interface ComponentDefinition {
  capability: Capability;
  /** Trusted developer validator; never supplied in an agent payload. */
  configSchema?: ZodType;
  validate?: (node: WorkspaceNode, dataPort: DataPort) => void;
}
export interface ComponentRegistry {
  get(id: string): Capability | undefined;
  list(): readonly Capability[];
  validate(node: WorkspaceNode, dataPort: DataPort): void;
}
/** Immutable per-workspace registry. Extend through declarations, not global mutation. */
export function createComponentRegistry(definitions: readonly ComponentDefinition[]): ComponentRegistry {
  const entries = new Map<string, ComponentDefinition>();
  const manifests = new Map<string, Capability>();
  for (const definition of definitions) {
    const { capability } = definition;
    if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,99}$/.test(capability.component) || entries.has(capability.component)) throw new Error("Component ids must be valid and unique");
    entries.set(capability.component, Object.freeze({ ...definition }));
    manifests.set(capability.component, Object.freeze({ ...capability,
      accepts: Object.freeze([...capability.accepts]), interactions: Object.freeze([...capability.interactions]),
      ...(definition.configSchema ? { configSchema: zodToJsonSchema(definition.configSchema, { $refStrategy: "none" }) as Readonly<Record<string, unknown>> } : {}),
    }));
  }
  const list = Object.freeze([...manifests.values()]);
  return Object.freeze({
    get: (id: string) => manifests.get(id),
    list: () => list,
    validate(node: WorkspaceNode, dataPort: DataPort) {
      const definition = entries.get(node.component);
      if (!definition) throw new Error("Unknown component");
      if (definition.configSchema) definition.configSchema.parse(node.config ?? {});
      else if (node.config && Object.keys(node.config).length) throw new Error("Component does not accept configuration");
      definition.validate?.(node, dataPort);
    },
  });
}
