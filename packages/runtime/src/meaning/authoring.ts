import {
  WIRE_LIMITS,
  createTypedAuthoring,
  validateMeaning,
  type Catalog,
  type DefineMetricInput,
  type MeaningDefinition,
  type Outcome,
  type TypedAuthoring,
  type VersionRef,
} from '@aeliqo/core';
import type {
  MeaningAuthoring,
  MeaningAuthoringOptions,
  MeaningDefinitionInput,
  MeaningDiff,
  MeaningDraft,
  MeaningSource,
} from './types.js';

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]};
}

/** Stable object ordering is used only for equality and local registry identities. */
export function canonicalMeaning(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonicalMeaning).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalMeaning(record[key])}`).join(',')}}`;
}

/** A bounded, deterministic digest for UI/cache identity. Equality also checks canonical contents. */
export function meaningDigest(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonicalMeaning(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `meaning-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function meaningRefKey(ref: VersionRef): string {
  return JSON.stringify([ref.id, ref.revision]);
}

export function freezeMeaningValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map((entry) => freezeMeaningValue(entry))) as T;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) copy[key] = freezeMeaningValue(child);
  return Object.freeze(copy) as T;
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validRef(value: unknown): value is VersionRef {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && validText((value as Record<string, unknown>).id, WIRE_LIMITS.id)
    && validText((value as Record<string, unknown>).revision, WIRE_LIMITS.id)
    && !/[\s]/u.test((value as Record<string, unknown>).id as string)
    && !/[\s]/u.test((value as Record<string, unknown>).revision as string);
}

function normalizeSource(source: MeaningSource | undefined, meaning: MeaningDefinition): Outcome<MeaningSource> {
  const value = source === undefined
    ? meaning.origin === 'ai-assisted'
      ? {surface: 'ai-assisted' as const, ownership: meaning.scope}
      : {surface: 'code' as const, ownership: 'code' as const, readOnly: true}
    : source;
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return failure('runtime.meaning-source', 'Meaning source must be a bounded object.', ['source']);
  if (value.surface !== 'code' && value.surface !== 'studio' && value.surface !== 'ai-assisted')
    return failure('runtime.meaning-source', 'Meaning source surface is unsupported.', ['source', 'surface']);
  if (!['code', 'session', 'personal', 'workspace', 'organization'].includes(value.ownership))
    return failure('runtime.meaning-source', 'Meaning ownership is unsupported.', ['source', 'ownership']);
  if (value.surface === 'ai-assisted' && meaning.origin !== 'ai-assisted')
    return failure('runtime.meaning-origin', 'AI-assisted source must preserve ai-assisted origin.', ['origin']);
  if (value.surface === 'code' && meaning.origin === 'ai-assisted')
    return failure('runtime.meaning-origin', 'Code-owned source cannot hide AI-assisted provenance.', ['origin']);
  if (value.ownerId !== undefined && !validText(value.ownerId, WIRE_LIMITS.id))
    return failure('runtime.meaning-source', 'Meaning owner identity is not bounded.', ['source', 'ownerId']);
  return {ok: true, value: freezeMeaningValue({
    surface: value.surface,
    ownership: value.ownership,
    ...(value.ownership === 'code' || value.readOnly === true ? {readOnly: true} : {}),
    ...(value.ownerId === undefined ? {} : {ownerId: value.ownerId}),
  })};
}

function normalizeAssumptions(input: readonly string[] | undefined): Outcome<readonly string[]> {
  const assumptions = input === undefined ? [] : input;
  if (!Array.isArray(assumptions) || assumptions.length > WIRE_LIMITS.diagnostics)
    return failure('runtime.meaning-assumptions', 'Meaning assumptions exceed their bound.', ['assumptions']);
  if (assumptions.some((assumption) => !validText(assumption, WIRE_LIMITS.label)))
    return failure('runtime.meaning-assumptions', 'Meaning assumptions must be bounded text.', ['assumptions']);
  return {ok: true, value: Object.freeze([...assumptions])};
}

function validateCandidate<C extends Catalog>(meaning: MeaningDefinition, options: MeaningAuthoringOptions<C>): Outcome<MeaningDefinition> {
  return validateMeaning(meaning, {
    catalog: options.catalog,
    registry: options.registry,
    ...(options.definitions === undefined ? {} : {definitions: options.definitions}),
    ...(options.policy === undefined ? {} : {policy: options.policy}),
  });
}

function makeDraft<C extends Catalog>(meaning: MeaningDefinition, options: MeaningAuthoringOptions<C>, draftOptions: {readonly source?: MeaningSource; readonly assumptions?: readonly string[]; readonly base?: VersionRef} = {}): Outcome<MeaningDraft> {
  if (draftOptions.base !== undefined && !validRef(draftOptions.base)) return failure('runtime.meaning-base', 'Meaning draft base reference is malformed.', ['base']);
  const checked = validateCandidate(meaning, options);
  if (!checked.ok) return checked;
  const source = normalizeSource(draftOptions.source ?? options.source, checked.value);
  if (!source.ok) return source;
  const assumptions = normalizeAssumptions(draftOptions.assumptions ?? options.assumptions);
  if (!assumptions.ok) return assumptions;
  const canonical = freezeMeaningValue(checked.value);
  const digest = meaningDigest(canonical);
  return {ok: true, value: freezeMeaningValue({version: '1' as const, meaning: canonical, source: source.value, digest, assumptions: assumptions.value,
    ...(draftOptions.base === undefined ? {} : {base: freezeMeaningValue({...draftOptions.base})})})};
}

function meaningFromBase(base: MeaningDraft | MeaningDefinition): {readonly meaning: MeaningDefinition; readonly source?: MeaningSource; readonly assumptions?: readonly string[]} {
  if ('meaning' in base && 'source' in base) return base;
  return {meaning: base};
}

function validMeaningBase(base: unknown): base is MeaningDraft | MeaningDefinition {
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return false;
  const value = base as Record<string, unknown>;
  const meaning = 'meaning' in value ? value.meaning : value;
  return meaning !== null && typeof meaning === 'object' && validRef(meaning);
}

function changedFields(left: MeaningDefinition, right: MeaningDefinition): readonly string[] {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.freeze([...keys].filter((key) => canonicalMeaning((left as Record<string, unknown>)[key]) !== canonicalMeaning((right as Record<string, unknown>)[key])).sort());
}

/**
 * Shared manual authoring surface. It delegates expression construction and all
 * type/grain/dependency checks to core's canonical typed authoring helper.
 */
export function createMeaningAuthoring<const C extends Catalog>(options: MeaningAuthoringOptions<C>): Outcome<MeaningAuthoring<C>> {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) return failure('runtime.meaning-authoring', 'Meaning authoring options are required.');
  const typed = createTypedAuthoring(options);
  if (!typed.ok) return typed;
  const value: TypedAuthoring<C> = typed.value;
  const defineMeaning = (input: MeaningDefinitionInput): Outcome<MeaningDraft> => {
    const expressionInput: DefineMetricInput = {
      id: input.id, ...(input.revision === undefined ? {} : {revision: input.revision}), label: input.label,
      description: input.description, expression: input.expression,
      ...(input.aggregation === undefined ? {} : {aggregation: input.aggregation}),
      ...(input.aggregationDimensions === undefined ? {} : {aggregationDimensions: input.aggregationDimensions}),
      ...(input.missingPolicy === undefined ? {} : {missingPolicy: input.missingPolicy}),
      ...(input.scope === undefined ? {} : {scope: input.scope}),
      ...(input.dependencies === undefined ? {} : {dependencies: input.dependencies}),
    };
    const base = value.defineMetric(expressionInput);
    if (!base.ok) return base;
    const meaning: MeaningDefinition = {
      ...base.value,
      ...(input.origin === undefined ? {} : {origin: input.origin}),
      ...(input.lifecycle === undefined ? {} : {lifecycle: input.lifecycle}),
      ...(input.authority === undefined ? {} : {authority: input.authority}),
      ...(input.scope === undefined ? {} : {scope: input.scope}),
    };
    return makeDraft(meaning, options, input.assumptions === undefined ? {} : {assumptions: input.assumptions});
  };
  const draft = (meaning: MeaningDefinition, draftOptions: {readonly source?: MeaningSource; readonly assumptions?: readonly string[]; readonly base?: VersionRef} = {}): Outcome<MeaningDraft> =>
    makeDraft(meaning, options, draftOptions);
  const edit = (base: MeaningDraft | MeaningDefinition, meaning: MeaningDefinition, editOptions: {readonly source?: MeaningSource; readonly assumptions?: readonly string[]} = {}): Outcome<MeaningDraft> => {
    if (!validMeaningBase(base)) return failure('runtime.meaning-base', 'Meaning edit requires a canonical base definition.', ['base']);
    const previous = meaningFromBase(base);
    const source = editOptions.source ?? previous.source;
    if (previous.source?.ownership === 'code' && canonicalMeaning(previous.meaning) !== canonicalMeaning(meaning))
      return failure('runtime.meaning-read-only', 'Code-owned meanings are read-only; submit a proposed diff or a new reviewed revision.', ['meaning']);
    const draftOptions = {
      ...(source === undefined ? {} : {source}),
      ...(editOptions.assumptions === undefined && previous.assumptions === undefined ? {} : {assumptions: editOptions.assumptions ?? previous.assumptions}),
      base: {id: previous.meaning.id, revision: previous.meaning.revision},
    };
    return makeDraft(meaning, options, draftOptions);
  };
  const proposeDiff = (base: MeaningDraft | MeaningDefinition, meaning: MeaningDefinition, diffOptions: {readonly source?: MeaningSource; readonly assumptions?: readonly string[]} = {}): Outcome<MeaningDiff> => {
    if (!validMeaningBase(base)) return failure('runtime.meaning-base', 'Meaning diff requires a canonical base definition.', ['base']);
    const previous = meaningFromBase(base);
    const candidateOptions = {
      ...((diffOptions.source ?? (previous.source?.ownership === 'code' ? {surface: 'studio', ownership: 'code', readOnly: true} : previous.source)) === undefined ? {} : {source: diffOptions.source ?? (previous.source?.ownership === 'code' ? {surface: 'studio', ownership: 'code', readOnly: true} : previous.source)}),
      ...(diffOptions.assumptions === undefined && previous.assumptions === undefined ? {} : {assumptions: diffOptions.assumptions ?? previous.assumptions}),
      base: {id: previous.meaning.id, revision: previous.meaning.revision},
    };
    const candidate = makeDraft(meaning, options, candidateOptions);
    if (!candidate.ok) return candidate;
    if (meaningRefKey(previous.meaning) === meaningRefKey(candidate.value.meaning) && canonicalMeaning(previous.meaning) === canonicalMeaning(candidate.value.meaning))
      return failure('runtime.meaning-no-change', 'The proposed meaning diff does not change its canonical definition.', ['meaning']);
    const priorOptions = {
      ...(previous.source === undefined ? {} : {source: previous.source}),
      ...(previous.assumptions === undefined ? {} : {assumptions: previous.assumptions}),
    };
    const priorResult = 'meaning' in base && 'source' in base
      ? {ok: true as const, value: base}
      : makeDraft(previous.meaning, options, priorOptions);
    const priorDraft = priorResult.ok ? priorResult.value : undefined;
    if (priorDraft === undefined) return failure('runtime.meaning-diff', 'The base meaning could not be normalized for diffing.', ['meaning']);
    return {ok: true, value: freezeMeaningValue({version: '1' as const, state: 'proposed-diff' as const, base: priorDraft, candidate: candidate.value, changed: changedFields(previous.meaning, candidate.value.meaning)})};
  };
  return {ok: true, value: Object.freeze({...value, defineMeaning, draft, edit, proposeDiff})};
}

export function createMeaningDraft<C extends Catalog>(meaning: MeaningDefinition, options: MeaningAuthoringOptions<C>, draftOptions?: {readonly source?: MeaningSource; readonly assumptions?: readonly string[]; readonly base?: VersionRef}): Outcome<MeaningDraft> {
  return makeDraft(meaning, options, draftOptions);
}
