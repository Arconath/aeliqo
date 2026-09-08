import {
  WIRE_LIMITS,
  authorizeMeaningActivation,
  validateMeaningBundle,
  type MeaningActivationReceipt,
  type MeaningDefinition,
  type MeaningBundle,
  type Outcome,
  type VersionRef,
} from '@aeliqo/core';
import {canonicalMeaning, createMeaningDraft, freezeMeaningValue, meaningDigest, meaningRefKey} from './authoring.js';
import type {
  MeaningEntry,
  MeaningActivationContext,
  MeaningActivationHost,
  MeaningDraft,
  MeaningRegistrationInput,
  MeaningRegistrationReceipt,
  MeaningRegistry,
  MeaningRegistryOptions,
  MeaningRevocationReceipt,
  MeaningSource,
} from './types.js';

function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {ok: false, diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}]};
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= WIRE_LIMITS.id && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function sourceForMeaning(meaning: MeaningDefinition, source?: MeaningSource): MeaningSource {
  if (source !== undefined) return source;
  return meaning.origin === 'ai-assisted'
    ? {surface: 'ai-assisted', ownership: meaning.scope === 'session' ? 'session' : meaning.scope}
    : {surface: 'code', ownership: 'code', readOnly: true};
}

function activationCandidate(context: MeaningActivationContext, draft: MeaningDefinition): MeaningDefinition | undefined {
  if (context.policy === null || typeof context.policy !== 'object' || !Array.isArray(context.policy.allowlistedDefinitions)) return undefined;
  return context.policy.allowlistedDefinitions.find((candidate) => sameRef(candidate, draft));
}

function sameActivationContext(left: MeaningActivationContext, right: MeaningActivationContext): boolean {
  return left.principalKey === right.principalKey
    && left.scopeDigest === right.scopeDigest
    && left.policyRevision === right.policyRevision
    && left.catalogRevision === right.catalogRevision
    && left.functionRegistryDigest === right.functionRegistryDigest
    && canonicalMeaning(left.allowedScopes) === canonicalMeaning(right.allowedScopes)
    && canonicalMeaning(left.policy) === canonicalMeaning(right.policy)
    && canonicalMeaning(left.readSet) === canonicalMeaning(right.readSet);
}

function contextFailure(context: MeaningActivationContext, meaning: MeaningDefinition, catalogRevision: string, registryDigest: string): Outcome<MeaningActivationReceipt> | undefined {
  if (context === null || typeof context !== 'object' || !Array.isArray(context.grants) || context.policy === null || typeof context.policy !== 'object' || !Array.isArray(context.policy.allowlistedDefinitions))
    return failure('runtime.meaning-authority', 'The trusted meaning activation context is malformed.');
  if (!validId(context.principalKey) || !validId(context.scopeDigest) || !validId(context.policyRevision))
    return failure('runtime.meaning-authority', 'The trusted meaning activation context is malformed.');
  if (context.catalogRevision !== catalogRevision || context.functionRegistryDigest !== registryDigest)
    return failure('runtime.meaning-stale', 'Meaning activation is stale for the current catalog or function registry.');
  if (!context.grants.includes('meaning.activate'))
    return failure('runtime.meaning-grant', 'The host did not grant meaning activation.');
  if (context.allowedScopes !== undefined && (!Array.isArray(context.allowedScopes) || !context.allowedScopes.includes(meaning.scope)))
    return failure('runtime.meaning-scope', 'The host activation policy does not allow this meaning scope.', ['scope']);
  return undefined;
}

function abortFailure<T>(signal: AbortSignal | undefined): Outcome<T> | undefined {
  return signal?.aborted ? failure('runtime.meaning-cancelled', 'Meaning activation was cancelled.') : undefined;
}

function validateRegistrationDraft(draft: MeaningDraft, options: MeaningRegistryOptions): Outcome<MeaningDraft> {
  try {
    if (draft === null || typeof draft !== 'object' || draft.version !== '1' || draft.meaning === undefined || draft.source === undefined)
      return failure('runtime.meaning-registration', 'Meaning registration requires a canonical versioned draft.');
    const prepared = createMeaningDraft(draft.meaning, {
      catalog: options.catalog,
      registry: options.registry,
      ...(options.definitions === undefined ? {} : {definitions: options.definitions}),
      ...(options.policy === undefined ? {} : {policy: options.policy}),
    }, {
      source: draft.source,
      assumptions: draft.assumptions,
      ...(draft.base === undefined ? {} : {base: draft.base}),
    });
    if (!prepared.ok) return prepared;
    if (typeof draft.digest !== 'string' || draft.digest !== prepared.value.digest)
      return failure('runtime.meaning-digest', 'Meaning draft digest does not match its canonical definition.', ['digest']);
    if (canonicalMeaning(draft.meaning) !== canonicalMeaning(prepared.value.meaning))
      return failure('runtime.meaning-registration', 'Meaning draft contents are not canonical.', ['meaning']);
    if (canonicalMeaning(draft.assumptions) !== canonicalMeaning(prepared.value.assumptions))
      return failure('runtime.meaning-assumptions', 'Meaning draft assumptions are not canonical.', ['assumptions']);
    return prepared;
  } catch {
    return failure('runtime.meaning-registration', 'Meaning registration failed safely at the draft boundary.');
  }
}

/**
 * Host-owned immutable definition registry. Registration is synchronous and
 * atomic; activation is the only asynchronous effect and performs a fresh
 * authority read both before and after the host policy check.
 */
export function createMeaningRegistry(options: MeaningRegistryOptions): Outcome<MeaningRegistry> {
  if (options === null || typeof options !== 'object') return failure('runtime.meaning-registry', 'Meaning registry options are required.');
  if (options.registry === null || typeof options.registry !== 'object' || Array.isArray(options.registry) || options.catalog === null || typeof options.catalog !== 'object' || Array.isArray(options.catalog))
    return failure('runtime.meaning-registry', 'A canonical catalog and function registry are required.');
  const maxEntries = options.maxEntries === undefined ? 512 : options.maxEntries;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0 || maxEntries > WIRE_LIMITS.presentationNodes)
    return failure('runtime.meaning-registry', 'Meaning registry capacity is outside its bound.', ['maxEntries']);
  if (!Array.isArray(options.catalog.meanings) || (options.definitions !== undefined && !Array.isArray(options.definitions)))
    return failure('runtime.meaning-registry', 'Meaning registry definitions must be arrays.', ['definitions']);
  const initial = options.definitions ?? [];
  const inheritedDefinitions = [...options.catalog.meanings, ...(options.definitions ?? [])];
  const bundle: MeaningBundle = {catalogRevision: options.catalog.revision, functionRegistryDigest: options.registry.digest, meanings: initial};
  let checked: ReturnType<typeof validateMeaningBundle>;
  try {
    checked = validateMeaningBundle(bundle, {catalog: options.catalog, registry: options.registry, definitions: inheritedDefinitions, ...(options.policy === undefined ? {} : {policy: options.policy})});
  } catch {
    return failure('runtime.meaning-registry', 'Meaning registry initialization failed safely.');
  }
  if (!checked.ok) return checked;
  const entries = new Map<string, MeaningEntry>();
  const activeScopes = new Map<string, string>();
  let generation = 0;

  const register = (input: MeaningRegistrationInput): Outcome<MeaningRegistrationReceipt> => {
    const draft = input?.draft;
    if (draft === null || typeof draft !== 'object') return failure('runtime.meaning-registration', 'Meaning registration requires a canonical draft.');
    if (input.activate !== undefined && typeof input.activate !== 'boolean') return failure('runtime.meaning-registration', 'Meaning registration activation must be a boolean.', ['activate']);
    const checkedDraft = validateRegistrationDraft(draft, options);
    if (!checkedDraft.ok) return checkedDraft;
    const canonicalDraft = checkedDraft.value;
    if (canonicalDraft.meaning.functionRegistryDigest !== options.registry.digest)
      return failure('runtime.meaning-stale', 'Meaning definition pins a different function registry digest.', ['meaning', 'functionRegistryDigest']);
    const key = meaningRefKey(canonicalDraft.meaning);
    const prior = entries.get(key);
    if (prior !== undefined) {
      if (prior.revoked) return failure('runtime.meaning-revoked', 'A revoked meaning version cannot be silently re-registered.', ['meaning', 'revision']);
      if (canonicalMeaning(prior.draft.meaning) !== canonicalMeaning(canonicalDraft.meaning))
        return failure('runtime.meaning-conflict', 'A meaning with this immutable ID and revision has different contents.', ['meaning', 'id', 'revision']);
      return {ok: true, value: freezeMeaningValue({state: 'registered' as const, meaning: {id: draft.meaning.id, revision: draft.meaning.revision}, digest: prior.draft.digest,
        catalogRevision: options.catalog.revision, idempotent: true, active: prior.active})};
    }
    if (entries.size >= maxEntries) return failure('runtime.meaning-budget', 'The meaning registry is full.');
    if (input.activate === true) return failure('runtime.meaning-activation-required', 'Registration cannot activate a meaning without a fresh host activation pass.');
    const immutableDraft = freezeMeaningValue(canonicalDraft);
    entries.set(key, Object.freeze({draft: immutableDraft, active: false, revoked: false}));
    generation += 1;
    return {ok: true, value: freezeMeaningValue({state: 'registered' as const, meaning: {id: canonicalDraft.meaning.id, revision: canonicalDraft.meaning.revision}, digest: canonicalDraft.digest,
      catalogRevision: options.catalog.revision, idempotent: false, active: false})};
  };

  const registerBundle = (input: MeaningBundle, source?: MeaningSource): Outcome<readonly MeaningRegistrationReceipt[]> => {
    let validated: ReturnType<typeof validateMeaningBundle>;
    try {
      validated = validateMeaningBundle(input, {catalog: options.catalog, registry: options.registry, definitions: inheritedDefinitions, ...(options.policy === undefined ? {} : {policy: options.policy})});
    } catch {
      return failure('runtime.meaning-registration', 'Meaning bundle validation failed safely.');
    }
    if (!validated.ok) return validated;
    const drafts: import('./types.js').MeaningDraft[] = [];
    for (const meaning of validated.value.meanings) {
      const prepared = createMeaningDraft(meaning, {catalog: options.catalog, registry: options.registry, definitions: inheritedDefinitions, ...(options.policy === undefined ? {} : {policy: options.policy})}, {source: sourceForMeaning(meaning, source)});
      if (!prepared.ok) return prepared;
      drafts.push(prepared.value);
    }
    const conflicts = new Set<string>();
    for (const draft of drafts) {
      const key = meaningRefKey(draft.meaning);
      const prior = entries.get(key);
      if (prior !== undefined && (prior.revoked || canonicalMeaning(prior.draft.meaning) !== canonicalMeaning(draft.meaning))) conflicts.add(key);
    }
    if (conflicts.size > 0) return failure('runtime.meaning-conflict', 'Meaning bundle conflicts with an immutable registered version.', ['meanings']);
    if (entries.size + drafts.filter((draft) => !entries.has(meaningRefKey(draft.meaning))).length > maxEntries)
      return failure('runtime.meaning-budget', 'The meaning registry is full.');
    const receipts: MeaningRegistrationReceipt[] = [];
    for (const draft of drafts) {
      const receipt = register({draft});
      if (!receipt.ok) return receipt;
      receipts.push(receipt.value);
    }
    return {ok: true, value: Object.freeze(receipts)};
  };

  const get = (ref: VersionRef): MeaningEntry | undefined => {
    if (!validId(ref?.id) || !validId(ref?.revision)) return undefined;
    return entries.get(meaningRefKey(ref));
  };
  const list = (filter: {readonly includeRevoked?: boolean; readonly activeOnly?: boolean} = {}): readonly MeaningEntry[] => Object.freeze([...entries.values()].filter((entry) => (filter.includeRevoked === true || !entry.revoked) && (filter.activeOnly !== true || entry.active)));
  const definitions = (filter: {readonly activeOnly?: boolean} = {}): readonly MeaningDefinition[] => {
    const output = new Map<string, MeaningDefinition>();
    for (const meaning of options.catalog.meanings) output.set(meaningRefKey(meaning), meaning);
    const listed = filter.activeOnly === undefined ? list() : list({activeOnly: filter.activeOnly});
    for (const entry of listed) if (entry.active) output.set(meaningRefKey(entry.draft.meaning), entry.draft.meaning);
    if (filter.activeOnly === true) return Object.freeze([...output.values()].filter((meaning) => meaning.lifecycle === 'active'));
    return Object.freeze([...output.values()]);
  };

  const activate = async (ref: VersionRef, activationOptions: {readonly signal?: AbortSignal} = {}): Promise<Outcome<MeaningActivationReceipt>> => {
    const cancelled = abortFailure<MeaningActivationReceipt>(activationOptions.signal);
    if (cancelled !== undefined) return cancelled;
    const entry = get(ref);
    if (entry === undefined) return failure('runtime.meaning-unknown', 'The requested meaning version is not registered.', ['meaning']);
    if (entry.revoked) return failure('runtime.meaning-revoked', 'The requested meaning version has been revoked.', ['meaning']);
    const host: MeaningActivationHost | undefined = options.activationHost;
    if (host === undefined) return failure('runtime.meaning-authority', 'Meaning activation requires a trusted host authority callback.');
    const beforeGeneration = generation;
    let before: Outcome<MeaningActivationContext>;
    try {
      before = await host.readContext({meaning: {id: entry.draft.meaning.id, revision: entry.draft.meaning.revision}, signal: activationOptions.signal ?? new AbortController().signal});
    } catch {
      return failure('runtime.meaning-authority', 'Meaning activation authority failed safely.');
    }
    if (!before.ok) return before;
    const beforeFailure = contextFailure(before.value, entry.draft.meaning, options.catalog.revision, options.registry.digest);
    if (beforeFailure !== undefined) return beforeFailure;
    const approved = activationCandidate(before.value, entry.draft.meaning);
    if (approved === undefined) return failure('runtime.meaning-activation-denied', 'The exact meaning version is not present in the trusted host activation allowlist.', ['meaning']);
    if (approved.origin !== entry.draft.meaning.origin) return failure('runtime.meaning-origin', 'Activation cannot erase the meaning origin recorded in the draft.', ['origin']);
    if (approved.lifecycle !== 'active') return failure('runtime.meaning-lifecycle', 'Activation requires a host-approved active definition.', ['lifecycle']);
    let candidateCheck: ReturnType<typeof validateMeaningBundle>;
    try {
      candidateCheck = validateMeaningBundle({catalogRevision: options.catalog.revision, functionRegistryDigest: options.registry.digest, meanings: [approved]}, {catalog: options.catalog, registry: options.registry, definitions: inheritedDefinitions, ...(options.policy === undefined ? {} : {policy: options.policy})});
    } catch {
      return failure('runtime.meaning-stale', 'Meaning activation validation failed safely.');
    }
    if (!candidateCheck.ok) return candidateCheck;
    const authorized = authorizeMeaningActivation(approved, before.value.policy);
    if (!authorized.ok) return authorized;
    const cancelledAfterCheck = abortFailure<MeaningActivationReceipt>(activationOptions.signal);
    if (cancelledAfterCheck !== undefined) return cancelledAfterCheck;
    let after: Outcome<MeaningActivationContext>;
    try {
      after = await host.readContext({meaning: {id: entry.draft.meaning.id, revision: entry.draft.meaning.revision}, signal: activationOptions.signal ?? new AbortController().signal});
    } catch {
      return failure('runtime.meaning-stale', 'Meaning activation authority could not be rechecked safely.');
    }
    if (!after.ok) return failure('runtime.meaning-stale', 'Meaning activation authority could not be rechecked safely.');
    const afterFailure = contextFailure(after.value, approved, options.catalog.revision, options.registry.digest);
    if (afterFailure !== undefined) return afterFailure;
    if (!sameActivationContext(before.value, after.value) || generation !== beforeGeneration || get(ref)?.revoked === true)
      return failure('runtime.meaning-stale', 'Meaning activation authority changed before the atomic publish.');
    const afterCandidate = activationCandidate(after.value, approved);
    if (afterCandidate === undefined || canonicalMeaning(afterCandidate) !== canonicalMeaning(approved))
      return failure('runtime.meaning-stale', 'The host activation definition changed before the atomic publish.');
    const current = get(ref);
    if (current === undefined || current.revoked) return failure('runtime.meaning-revoked', 'Meaning was revoked before activation completed.');
    const activeDraft = freezeMeaningValue({...current.draft, meaning: approved, digest: meaningDigest(approved)});
    entries.set(meaningRefKey(ref), Object.freeze({draft: activeDraft, active: true, revoked: false}));
    activeScopes.set(meaningRefKey(ref), before.value.scopeDigest);
    generation += 1;
    return authorized;
  };

  const revoke = (ref: VersionRef): Outcome<MeaningRevocationReceipt> => {
    if (!validId(ref?.id) || !validId(ref?.revision)) return failure('runtime.meaning-invalid', 'The meaning reference is malformed.', ['meaning']);
    const key = meaningRefKey(ref);
    const prior = entries.get(key);
    if (prior === undefined) return failure('runtime.meaning-unknown', 'The requested meaning version is not registered.', ['meaning']);
    if (prior.revoked) return {ok: true, value: freezeMeaningValue({state: 'revoked' as const, meaning: {id: prior.draft.meaning.id, revision: prior.draft.meaning.revision}, catalogRevision: options.catalog.revision})};
    entries.set(key, Object.freeze({draft: prior.draft, active: false, revoked: true}));
    activeScopes.delete(key);
    generation += 1;
    return {ok: true, value: freezeMeaningValue({state: 'revoked' as const, meaning: {id: prior.draft.meaning.id, revision: prior.draft.meaning.revision}, catalogRevision: options.catalog.revision})};
  };
  const revokeScope = (scopeDigest: string): Outcome<readonly MeaningRevocationReceipt[]> => {
    if (!validId(scopeDigest)) return failure('runtime.meaning-scope', 'The scope digest is malformed.', ['scopeDigest']);
    const receipts: MeaningRevocationReceipt[] = [];
    for (const [key, entry] of entries) if (activeScopes.get(key) === scopeDigest && entry.active) {
      const result = revoke({id: entry.draft.meaning.id, revision: entry.draft.meaning.revision});
      if (!result.ok) return result;
      receipts.push(result.value);
    }
    return {ok: true, value: Object.freeze(receipts)};
  };

  const registry: MeaningRegistry = Object.freeze({catalog: options.catalog, registry: options.registry, register, registerBundle, get, list, definitions, activate, revoke, revokeScope});
  return {ok: true, value: registry};
}
