import { z } from 'zod';
import { capabilityContracts, type CapabilityName } from '@aeliqo/core';
export { patchSchema, querySchema, searchSchema } from '@aeliqo/core';
const id = z.string().min(1).max(100);
export const pairingSchema = z.object({type:z.literal('pair'),token:z.string().min(1).max(200),workspaceId:id,rendererId:id}).strict();
export const pairedSchema = z.object({type:z.literal('paired'),workspaceId:id,rendererId:id}).strict();
export const targetSchema = z.object({workspaceId:id,rendererId:id}).strict();
export const requestSchema = z.object({id, target:targetSchema,method:z.string(),params:z.unknown(),source:z.enum(['MCP','BYOK']).default('MCP')}).strict().transform(value => {
  const contract = capabilityContracts.find(contract => contract.id === value.method);
  if (!contract) throw new Error('Unknown capability');
  return {...value, method: value.method as CapabilityName, params:contract.inputSchema.parse(value.params)};
});
export const responseSchema = z.object({ id, ok: z.boolean(), result: z.unknown().optional(), error: z.string().optional() }).strict();
export type BridgeRequest = z.infer<typeof requestSchema>;
