import {
  createMeaningAuthoring,
  createMeaningEvaluator,
  type MeaningAuthoring,
  type MeaningDefinitionInput,
  type MeaningDraft,
  type MeaningDiff,
  type MeaningEvaluator,
} from '@aeliqo/sdk-runtime/meaning';
import type {
  Catalog,
  MeaningDefinition,
  Outcome,
  VersionRef,
} from '@aeliqo/sdk-core';
import {parseWireValue} from '@aeliqo/sdk-core';
import type {
  AgentMeaningAuthoring,
  AgentMeaningAuthoringOptions,
  MeaningProposalInput,
  MeaningProposalPolicy,
} from './types.js';

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]};
}

const DEFAULT_SCOPES: readonly MeaningDefinition['scope'][] = Object.freeze(['session', 'personal']);

function snapshotProposalPolicy(policy: MeaningProposalPolicy | undefined): Outcome<MeaningProposalPolicy | undefined> {
  if (policy === undefined) return {ok: true, value: undefined};
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy))
    return failure('agent.meaning-policy', 'AI meaning proposal policy must be a bounded object.', ['proposalPolicy']);
  if (policy.allowedScopes !== undefined && !Array.isArray(policy.allowedScopes))
    return failure('agent.meaning-policy', 'AI meaning proposal scopes must be an array.', ['proposalPolicy', 'allowedScopes']);
  if (policy.requireHypothesis !== undefined && typeof policy.requireHypothesis !== 'boolean')
    return failure('agent.meaning-policy', 'AI meaning hypothesis policy must be boolean.', ['proposalPolicy', 'requireHypothesis']);
  if (policy.requireDraft !== undefined && typeof policy.requireDraft !== 'boolean')
    return failure('agent.meaning-policy', 'AI meaning draft policy must be boolean.', ['proposalPolicy', 'requireDraft']);
  let allowedScopes: readonly MeaningDefinition['scope'][] | undefined;
  if (policy.allowedScopes !== undefined) {
    const inspected = parseWireValue(policy.allowedScopes);
    if (!inspected.ok) return {ok: false, diagnostics: inspected.diagnostics};
    if (!Array.isArray(inspected.value) || !inspected.value.every((scope): scope is MeaningDefinition['scope'] => typeof scope === 'string'))
      return failure('agent.meaning-policy', 'AI meaning proposal scopes must be bounded strings.', ['proposalPolicy', 'allowedScopes']);
    allowedScopes = Object.freeze([...inspected.value]);
  }
  return {ok: true, value: Object.freeze({
    ...(allowedScopes === undefined ? {} : {allowedScopes}),
    ...(policy.requireHypothesis === undefined ? {} : {requireHypothesis: policy.requireHypothesis}),
    ...(policy.requireDraft === undefined ? {} : {requireDraft: policy.requireDraft}),
  }) as MeaningProposalPolicy};
}

function checkPolicy(meaning: MeaningDefinition, policy: MeaningProposalPolicy | undefined): Outcome<void> {
  if (meaning === null || typeof meaning !== 'object' || Array.isArray(meaning))
    return failure('agent.meaning-proposal', 'An AI meaning proposal requires a canonical definition.', ['meaning']);
  const allowedScopes = policy?.allowedScopes ?? DEFAULT_SCOPES;
  if (!allowedScopes.includes(meaning.scope)) return failure('agent.meaning-scope', 'AI meaning proposals are limited to the configured low-risk scope.', ['scope']);
  if ((policy?.requireHypothesis ?? true) && meaning.authority !== 'hypothesis')
    return failure('agent.meaning-authority', 'AI meaning proposals must retain hypothesis authority.', ['authority']);
  if ((policy?.requireDraft ?? true) && meaning.lifecycle !== 'draft')
    return failure('agent.meaning-lifecycle', 'AI meaning proposals must remain drafts until host activation.', ['lifecycle']);
  if (meaning.origin !== 'ai-assisted') return failure('agent.meaning-origin', 'An AI authoring route cannot erase AI provenance.', ['origin']);
  return {ok: true, value: undefined};
}

function aiSource(meaning: MeaningDefinition): {readonly surface: 'ai-assisted'; readonly ownership: MeaningDefinition['scope']} {
  return {surface: 'ai-assisted', ownership: meaning.scope};
}

/**
 * AI-assisted authoring is a proposal adapter only. It has no model/provider
 * dependency and delegates definition construction, validation and evaluation
 * to the runtime's canonical manual authoring/evaluator surfaces.
 */
export function createAgentMeaningAuthoring<const C extends Catalog>(options: AgentMeaningAuthoringOptions<C>): Outcome<AgentMeaningAuthoring<C>> {
  const manual = createMeaningAuthoring(options);
  if (!manual.ok) return manual;
  const policyResult = snapshotProposalPolicy(options.proposalPolicy);
  if (!policyResult.ok) return policyResult;
  const policy = policyResult.value;
  const defineMeaning = (input: MeaningDefinitionInput): Outcome<MeaningDraft> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input))
      return failure('agent.meaning-proposal', 'An AI meaning definition requires a bounded input object.');
    if (input.origin !== undefined && input.origin !== 'ai-assisted') return failure('agent.meaning-origin', 'The AI authoring route cannot claim manual or system provenance.', ['origin']);
    if (input.lifecycle !== undefined && input.lifecycle !== 'draft') return failure('agent.meaning-lifecycle', 'The AI authoring route can only create drafts.', ['lifecycle']);
    if (input.authority !== undefined && input.authority !== 'hypothesis') return failure('agent.meaning-authority', 'The AI authoring route can only create hypothesis definitions.', ['authority']);
    const scope = input.scope ?? 'session';
    const built = manual.value.defineMeaning({...input, origin: 'ai-assisted', lifecycle: 'draft', authority: 'hypothesis', scope});
    if (!built.ok) return built;
    const checked = checkPolicy(built.value.meaning, policy);
    if (!checked.ok) return checked;
    return manual.value.draft(built.value.meaning, {
      source: aiSource(built.value.meaning),
      ...(input.assumptions === undefined ? {} : {assumptions: input.assumptions}),
    });
  };
  const propose = (input: MeaningProposalInput): Outcome<MeaningDraft> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input) || input.meaning === undefined)
      return failure('agent.meaning-proposal', 'An AI meaning proposal requires one canonical definition.', ['meaning']);
    const checked = checkPolicy(input.meaning, policy);
    if (!checked.ok) return checked;
    const source = aiSource(input.meaning);
    return manual.value.draft(input.meaning, {
      source,
      ...(input.assumptions === undefined ? {} : {assumptions: input.assumptions}),
      ...(input.base === undefined ? {} : {base: input.base}),
    });
  };
  const proposeDiff = (base: MeaningDraft | MeaningDefinition, meaning: MeaningDefinition, diffOptions: {readonly assumptions?: readonly string[]} = {}): Outcome<MeaningDiff> => {
    const checked = checkPolicy(meaning, policy);
    if (!checked.ok) return checked;
    return manual.value.proposeDiff(base, meaning, {
      source: aiSource(meaning),
      ...(diffOptions.assumptions === undefined ? {} : {assumptions: diffOptions.assumptions}),
    });
  };
  let evaluator: MeaningEvaluator | undefined;
  const evaluatorOptions = options.evaluator ?? {
    catalog: options.catalog,
    registry: options.registry,
    ...(options.definitions === undefined ? {} : {definitions: options.definitions}),
    ...(options.policy === undefined ? {} : {policy: options.policy}),
  };
  const evaluated = createMeaningEvaluator(evaluatorOptions);
  if (!evaluated.ok) return evaluated;
  evaluator = evaluated.value;
  return {ok: true, value: Object.freeze({manual: manual.value, defineMeaning, propose, proposeDiff, evaluator})};
}

/** Alias used by integrations that call the operation an AI draft builder. */
export const createMeaningProposalAuthoring = createAgentMeaningAuthoring;

export type {Catalog, MeaningAuthoring, MeaningDefinitionInput, MeaningDefinition, Outcome, VersionRef};
