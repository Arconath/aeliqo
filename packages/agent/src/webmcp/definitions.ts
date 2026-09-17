import { parseWireValue, type Outcome } from '@aeliqo/core';
import type { AgentToolDefinition, AgentToolInputSchema } from '../protocol/types.js';
import type { WebMcpToolAnnotations } from './types.js';

const MAX_REFERENCE = 256;
const MAX_DESCRIPTION = 4096;
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,64}$/u;
const OPERATIONS = new Set([
  'catalog.read',
  'result.inspect',
  'task.propose',
  'task.evaluate',
  'experience.propose',
  'experience.commit',
  'meaning.propose',
  'meaning.activate',
  'action.propose',
  'action.execute',
  'model.egress',
]);

function failure<T>(code: string, message: string): Outcome<T> {
  return { ok: false, diagnostics: [{ code, message, retryable: false }] };
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validCapability(value: unknown): value is { readonly id: string; readonly revision: string } {
  if (!isObject(value)) return false;
  return validText(value.id, MAX_REFERENCE) && validText(value.revision, MAX_REFERENCE);
}

function validSchemaReferences(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(validSchemaReferences);
  return Object.entries(value).every(
    ([key, child]) =>
      (key !== '$ref' || (typeof child === 'string' && child.startsWith('#'))) && validSchemaReferences(child),
  );
}

function normalizeSchema(value: unknown): Outcome<AgentToolInputSchema> {
  if (!isObject(value)) return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid input schema.');
  const schema = parseWireValue(value);
  if (!schema.ok || !isObject(schema.value) || schema.value.type !== 'object' || !validSchemaReferences(schema.value))
    return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid input schema.');
  return { ok: true, value: schema.value as AgentToolInputSchema };
}

function cloneFrozen(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneFrozen(child)])));
}

function freezeDefinition(input: AgentToolDefinition): AgentToolDefinition {
  const schema = cloneFrozen(input.inputSchema) as AgentToolInputSchema;
  return Object.freeze({
    name: input.name,
    description: input.description,
    capability: Object.freeze({ ...input.capability }),
    operation: input.operation,
    inputSchema: schema,
  });
}

function normalizeDefinition(candidate: unknown, names: ReadonlySet<string>): Outcome<AgentToolDefinition> {
  if (!isObject(candidate)) return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid definition.');
  if (typeof candidate.name !== 'string' || !TOOL_NAME.test(candidate.name) || names.has(candidate.name))
    return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid definition.');
  if (!validText(candidate.description, MAX_DESCRIPTION) || !validCapability(candidate.capability))
    return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid definition.');
  if (typeof candidate.operation !== 'string' || !OPERATIONS.has(candidate.operation))
    return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid definition.');
  const schema = normalizeSchema(candidate.inputSchema);
  if (!schema.ok) return schema;
  return {
    ok: true,
    value: freezeDefinition({
      name: candidate.name,
      description: candidate.description,
      capability: { id: candidate.capability.id, revision: candidate.capability.revision },
      operation: candidate.operation as AgentToolDefinition['operation'],
      inputSchema: schema.value,
    }),
  };
}

export function normalizeDefinitions(input: readonly AgentToolDefinition[]): Outcome<readonly AgentToolDefinition[]> {
  if (!Array.isArray(input) || input.length > 128)
    return failure('agent.webmcp.discovery', 'Tool discovery returned an invalid list.');
  const names = new Set<string>();
  const definitions: AgentToolDefinition[] = [];
  for (const candidate of input) {
    const normalized = normalizeDefinition(candidate, names);
    if (!normalized.ok) return normalized;
    names.add(normalized.value.name);
    definitions.push(normalized.value);
  }
  return { ok: true, value: Object.freeze(definitions) };
}

export function nativeAnnotations(operation: AgentToolDefinition['operation']): WebMcpToolAnnotations {
  const readOnlyHint = operation === 'catalog.read' || operation === 'result.inspect' || operation === 'task.evaluate';
  const consequentialHint =
    operation === 'experience.commit' ||
    operation === 'meaning.activate' ||
    operation === 'action.execute' ||
    operation === 'model.egress';
  return Object.freeze({ readOnlyHint, untrustedContentHint: true, consequentialHint });
}
