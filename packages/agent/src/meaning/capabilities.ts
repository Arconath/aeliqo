import {
  parseWireValue,
  WIRE_LIMITS,
  type MeaningDefinition,
  type Outcome,
  type VersionRef,
} from '@aeliqo/core';
import type {
  AgentCapabilityContext,
  AgentCapabilityHandlerResult,
  AgentCapabilityManifest,
} from '../capabilities/types.js';
import type {
  AgentMeaningAuthoring,
  MeaningActivationCapabilityOptions,
  MeaningProposalCapabilityOptions,
  MeaningProposalInput,
} from './types.js';

const PROPOSAL_REF: VersionRef = Object.freeze({id: 'aeliqo.meaning.proposal', revision: '1'});
const ACTIVATION_REF: VersionRef = Object.freeze({id: 'aeliqo.meaning.activation', revision: '1'});

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]};
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Parse only bounded JSON data; semantic meaning validation remains in runtime. */
export function parseMeaningProposalInput(input: unknown): Outcome<MeaningProposalInput> {
  const wire = parseWireValue(input);
  if (!wire.ok) return wire;
  const object = asRecord(wire.value);
  if (object === undefined) return failure('agent.meaning-proposal', 'A meaning proposal must be a bounded object.');
  const candidate = asRecord(object.meaning) === undefined && 'implementation' in object ? object : asRecord(object.meaning);
  if (candidate === undefined) return failure('agent.meaning-proposal', 'A meaning proposal requires a canonical definition.', ['meaning']);
  const assumptions = object.assumptions;
  if (assumptions !== undefined && (!Array.isArray(assumptions) || assumptions.length > WIRE_LIMITS.diagnostics || assumptions.some((item) => typeof item !== 'string'))) return failure('agent.meaning-proposal', 'Meaning assumptions are malformed.', ['assumptions']);
  const base = object.base;
  if (base !== undefined) {
    const baseRecord = asRecord(base);
    if (baseRecord === undefined || !validId(baseRecord.id) || !validId(baseRecord.revision)) return failure('agent.meaning-proposal', 'The proposed meaning base reference is malformed.', ['base']);
  }
  return {ok: true, value: Object.freeze({meaning: candidate as unknown as MeaningDefinition,
    ...(assumptions === undefined ? {} : {assumptions: Object.freeze([...assumptions] as string[])}),
    ...(base === undefined ? {} : {base: Object.freeze({...(base as Record<string, unknown>)}) as VersionRef})})};
}

export function parseMeaningActivationInput(input: unknown): Outcome<VersionRef> {
  const wire = parseWireValue(input);
  if (!wire.ok) return wire;
  const object = asRecord(wire.value);
  const candidate = object !== undefined && object.meaning !== undefined ? asRecord(object.meaning) : object;
  if (candidate === undefined || !validId(candidate.id) || !validId(candidate.revision)) return failure('agent.meaning-activation', 'A meaning activation reference is malformed.', ['meaning']);
  return {ok: true, value: Object.freeze({id: candidate.id, revision: candidate.revision})};
}

function output<T>(state: AgentCapabilityHandlerResult<T>['state'], value: T): AgentCapabilityHandlerResult<T> {
  return {state, value};
}

/** Registered proposal adapter; it never activates or executes a meaning. */
export function createMeaningProposalCapability<C extends import('@aeliqo/core').Catalog = import('@aeliqo/core').Catalog>(options: MeaningProposalCapabilityOptions<C>): AgentCapabilityManifest<MeaningProposalInput, MeaningDraftJson> {
  if (options === null || typeof options !== 'object' || options.authoring === undefined) throw new TypeError('Meaning proposal authoring is required.');
  const ref = options.ref ?? PROPOSAL_REF;
  return Object.freeze({
    ref: Object.freeze({id: ref.id, revision: ref.revision}),
    operation: 'meaning.propose' as const,
    label: 'Propose a typed meaning',
    description: 'Validate an AI-assisted hypothesis through the canonical meaning authoring route.',
    parse: parseMeaningProposalInput,
    invoke(input: MeaningProposalInput, _context: AgentCapabilityContext): AgentCapabilityHandlerResult<MeaningDraftJson> {
      const proposed = options.authoring.propose(input);
      if (!proposed.ok) return {state: proposed.diagnostics.some((item) => item.code === 'agent.meaning-scope') ? 'denied' : 'invalid', diagnostics: proposed.diagnostics};
      return output('accepted', proposed.value as unknown as MeaningDraftJson);
    },
  });
}

/** Registered activation adapter; authority is read by the runtime registry host. */
export function createMeaningActivationCapability(options: MeaningActivationCapabilityOptions): AgentCapabilityManifest<VersionRef, MeaningActivationJson> {
  if (options === null || typeof options !== 'object' || options.registry === undefined) throw new TypeError('Meaning registry is required.');
  const ref = options.ref ?? ACTIVATION_REF;
  return Object.freeze({
    ref: Object.freeze({id: ref.id, revision: ref.revision}),
    operation: 'meaning.activate' as const,
    label: 'Activate an authorized meaning',
    description: 'Recheck host policy and publish one exact immutable meaning revision.',
    parse: parseMeaningActivationInput,
    async invoke(input: VersionRef, context: AgentCapabilityContext): Promise<AgentCapabilityHandlerResult<MeaningActivationJson>> {
      try {
        const activated = await options.registry.activate(input, {signal: context.signal, expectedAuthority: {principalKey: context.authority.principalKey, ...(context.authority.current === undefined ? {} : {readSet: context.authority.current})}});
        if (!activated.ok) {
          const codes = activated.diagnostics.map((item) => item.code);
          const state = codes.some((code) => code.includes('cancelled')) ? 'cancelled'
            : codes.some((code) => code.includes('stale') || code.includes('revoked')) ? 'stale'
            : codes.some((code) => code.includes('unsupported')) ? 'unsupported'
            : codes.some((code) => code.includes('unknown') || code.includes('invalid') || code.includes('conflict') || code.includes('shape')) ? 'invalid'
            : 'denied';
          return {state, diagnostics: activated.diagnostics};
        }
        return output('accepted', activated.value as unknown as MeaningActivationJson);
      } catch {
        return {state: 'failed', diagnostics: [{code: 'agent.meaning-activation', message: 'Meaning activation failed safely.', retryable: false}]};
      }
    },
  });
}

export const createAgentMeaningProposalCapability = createMeaningProposalCapability;
export const createAgentMeaningActivationCapability = createMeaningActivationCapability;

/** JSON-shaped aliases keep capability outputs on the dispatcher wire boundary. */
export type MeaningDraftJson = import('../capabilities/types.js').AgentJsonValue;
export type MeaningActivationJson = import('../capabilities/types.js').AgentJsonValue;
export type {AgentMeaningAuthoring, MeaningProposalCapabilityOptions, MeaningActivationCapabilityOptions};
