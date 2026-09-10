import {
  WIRE_LIMITS,
  parseWireValue,
  authorizeMeaningActivation,
  validateMeaningBundle,
  type MeaningActivationReceipt,
  type MeaningDefinition,
  type MeaningBundle,
  type Outcome,
  type VersionRef,
} from '@aeliqo/sdk-core';
import {canonicalMeaning, createMeaningDraft, freezeMeaningValue, meaningDigest, meaningRefKey, snapshotMeaningAuthoringOptions} from './authoring.js';
import type {
  MeaningEntry,
  MeaningActivationOptions,
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
  return context.policy.allowlistedDefinitions.find((candidate) => candidate !== null && typeof candidate === 'object' && sameRef(candidate, draft));
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
  if (context.policy.policyRevision !== context.policyRevision)
    return failure('runtime.meaning-stale', 'Meaning activation policy revisions disagree.');
  if (context.catalogRevision !== catalogRevision || context.functionRegistryDigest !== registryDigest)
    return failure('runtime.meaning-stale', 'Meaning activation is stale for the current catalog or function registry.');
  if (context.readSet !== undefined && (context.readSet === null || typeof context.readSet !== 'object'
    || context.readSet.scopeDigest !== context.scopeDigest || context.readSet.policyRevision !== context.policyRevision
    || context.readSet.catalogRevision !== context.catalogRevision || context.readSet.functionRegistryDigest !== context.functionRegistryDigest))
    return failure('runtime.meaning-stale', 'Meaning activation read-set pins disagree with the current authority.');
  if (!context.grants.includes('meaning.activate'))
    return failure('runtime.meaning-grant', 'The host did not grant meaning activation.');
  if (context.allowedScopes !== undefined && (!Array.isArray(context.allowedScopes) || !context.allowedScopes.includes(meaning.scope)))
    return failure('runtime.meaning-scope', 'The host activation policy does not allow this meaning scope.', ['scope']);
  return undefined;
}

function snapshotContext(result: Outcome<MeaningActivationContext>): Outcome<MeaningActivationContext> {
  if (!result || result.ok !== true) return failure('runtime.meaning-authority', 'Meaning activation authority was unavailable.');
  const parsed = parseWireValue(result.value);
  if (!parsed.ok) return failure('runtime.meaning-authority', 'Meaning activation context must be bounded plain data.');
  return {ok: true, value: freezeMeaningValue(parsed.value) as unknown as MeaningActivationContext};
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
  const snapshot = snapshotMeaningAuthoringOptions(options);
  if (!snapshot.ok) return snapshot;
  if (options.activationHost !== undefined && (options.activationHost === null || typeof options.activationHost.readContext !== 'function'))
    return failure('runtime.meaning-authority', 'Meaning activation requires a callable trusted host.');
  options = Object.freeze({...snapshot.value,
    ...(options.maxEntries === undefined ? {} : {maxEntries: options.maxEntries}),
    ...(options.maxBytes === undefined ? {} : {maxBytes: options.maxBytes}),
    ...(options.activationHost === undefined ? {} : {activationHost: Object.freeze({readContext: options.activationHost.readContext.bind(options.activationHost)})}),
  });
  const maxEntries = options.maxEntries === undefined ? 512 : options.maxEntries;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0 || maxEntries > WIRE_LIMITS.presentationNodes)
    return failure('runtime.meaning-registry', 'Meaning registry capacity is outside its bound.', ['maxEntries']);
  const maxBytes = options.maxBytes ?? WIRE_LIMITS.bytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > WIRE_LIMITS.bytes)
    return failure('runtime.meaning-budget', 'Meaning registry byte capacity is outside its bound.', ['maxBytes']);
  const draftBytes = (draft: MeaningDraft): number => new TextEncoder().encode(canonicalMeaning(draft)).byteLength;
  if (!Array.isArray(options.catalog.meanings) || (options.definitions !== undefined && !Array.isArray(options.definitions)))
    return failure('runtime.meaning-registry', 'Meaning registry definitions must be arrays.', ['definitions']);
  const inheritedDefinitions = [...options.catalog.meanings, ...(options.definitions ?? [])];
  const initial = inheritedDefinitions;
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
  const revokedScopes = new Set<string>();
  let generation = 0;
  let retainedBytes = 0;
  let activatedOwner: {readonly principalKey: string; readonly scopeDigest: string} | undefined;

  const availableDefinitions = (): readonly MeaningDefinition[] => {
    const visible = new Map(inheritedDefinitions.map((meaning) => [meaningRefKey(meaning), meaning]));
    for (const [key, entry] of entries) {
      if (entry.revoked) visible.delete(key);
      else visible.set(key, entry.draft.meaning);
    }
    return [...visible.values()];
  };
  const validationOptions = (definitions = availableDefinitions()): MeaningRegistryOptions => ({
    ...options,
    catalog: {...options.catalog, meanings: options.catalog.meanings.filter((meaning) => !entries.get(meaningRefKey(meaning))?.revoked)},
    definitions,
  });
  const publishRegistration = (canonicalDraft: MeaningDraft): Outcome<MeaningRegistrationReceipt> => {
    const key = meaningRefKey(canonicalDraft.meaning);
    const prior = entries.get(key);
    if (prior !== undefined) {
      if (prior.revoked) return failure('runtime.meaning-revoked', 'A revoked meaning version cannot be silently re-registered.', ['meaning', 'revision']);
      if (canonicalMeaning(prior.draft.meaning) !== canonicalMeaning(canonicalDraft.meaning))
        return failure('runtime.meaning-conflict', 'A meaning with this immutable ID and revision has different contents.', ['meaning', 'id', 'revision']);
      return {ok: true, value: freezeMeaningValue({state: 'registered' as const, meaning: {id: canonicalDraft.meaning.id, revision: canonicalDraft.meaning.revision}, digest: prior.draft.digest,
        catalogRevision: options.catalog.revision, idempotent: true, active: prior.active})};
    }
    if (entries.size >= maxEntries) return failure('runtime.meaning-budget', 'The meaning registry is full.');
    const bytes = draftBytes(canonicalDraft);
    if (retainedBytes + bytes > maxBytes) return failure('runtime.meaning-budget', 'The meaning registry byte capacity is exhausted.');
    retainedBytes += bytes;
    entries.set(key, Object.freeze({draft: freezeMeaningValue(canonicalDraft), active: false, revoked: false}));
    generation += 1;
    return {ok: true, value: freezeMeaningValue({state: 'registered' as const, meaning: {id: canonicalDraft.meaning.id, revision: canonicalDraft.meaning.revision}, digest: canonicalDraft.digest,
      catalogRevision: options.catalog.revision, idempotent: false, active: false})};
  };

  const register = (input: MeaningRegistrationInput): Outcome<MeaningRegistrationReceipt> => {
    const draft = input?.draft;
    if (draft === null || typeof draft !== 'object') return failure('runtime.meaning-registration', 'Meaning registration requires a canonical draft.');
    if (input.activate !== undefined && typeof input.activate !== 'boolean') return failure('runtime.meaning-registration', 'Meaning registration activation must be a boolean.', ['activate']);
    const checkedDraft = validateRegistrationDraft(draft, validationOptions());
    if (!checkedDraft.ok) return checkedDraft;
    const canonicalDraft = checkedDraft.value;
    if (canonicalDraft.meaning.functionRegistryDigest !== options.registry.digest)
      return failure('runtime.meaning-stale', 'Meaning definition pins a different function registry digest.', ['meaning', 'functionRegistryDigest']);
    if (input.activate === true) return failure('runtime.meaning-activation-required', 'Registration cannot activate a meaning without a fresh host activation pass.');
    return publishRegistration(canonicalDraft);
  };

  const registerBundle = (input: MeaningBundle, source?: MeaningSource): Outcome<readonly MeaningRegistrationReceipt[]> => {
    let validated: ReturnType<typeof validateMeaningBundle>;
    try {
      validated = validateMeaningBundle(input, validationOptions());
    } catch {
      return failure('runtime.meaning-registration', 'Meaning bundle validation failed safely.');
    }
    if (!validated.ok) return validated;
    const prospective = validationOptions([...availableDefinitions(), ...validated.value.meanings]);
    const drafts: MeaningDraft[] = [];
    for (const meaning of validated.value.meanings) {
      const prepared = createMeaningDraft(meaning, prospective, {source: sourceForMeaning(meaning, source)});
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
    if (retainedBytes + drafts.filter((draft) => !entries.has(meaningRefKey(draft.meaning))).reduce((sum, draft) => sum + draftBytes(draft), 0) > maxBytes)
      return failure('runtime.meaning-budget', 'The meaning registry byte capacity is exhausted.');
    const receipts: MeaningRegistrationReceipt[] = [];
    for (const draft of drafts) {
      const receipt = publishRegistration(draft);
      if (!receipt.ok) return receipt;
      receipts.push(receipt.value);
    }
    return {ok: true, value: Object.freeze(receipts)};
  };

  const get = (ref: VersionRef): MeaningEntry | undefined => {
    if (!validId(ref?.id) || !validId(ref?.revision)) return undefined;
    return entries.get(meaningRefKey(ref));
  };
  const list = (filter: {readonly includeRevoked?: boolean; readonly activeOnly?: boolean} = {}): readonly MeaningEntry[] => Object.freeze([...entries.values()].filter((entry) => (filter?.includeRevoked === true || !entry.revoked) && (filter?.activeOnly !== true || entry.active)));
  const definitions = (filter: {readonly activeOnly?: boolean} = {}): readonly MeaningDefinition[] => {
    const output = new Map(availableDefinitions().filter((meaning) => {
      const entry = entries.get(meaningRefKey(meaning));
      return (entry === undefined || entry.active || inheritedDefinitions.some((inherited) => sameRef(inherited, meaning))) && (filter?.activeOnly !== true || meaning.lifecycle === 'active');
    }).map((meaning) => [meaningRefKey(meaning), meaning]));
    // Removing a definition also removes derived definitions whose closure is no longer available.
    let changed = true;
    while (changed) {
      changed = false;
      for (const [key, meaning] of output) if (meaning.dependencies.some((ref) => !output.has(meaningRefKey(ref)))) {
        output.delete(key); changed = true;
      }
    }
    return Object.freeze([...output.values()]);
  };

  const activate = async (ref: VersionRef, activationOptions: MeaningActivationOptions = {}): Promise<Outcome<MeaningActivationReceipt>> => {
    if (activationOptions === null || typeof activationOptions !== 'object' || Array.isArray(activationOptions))
      return failure('runtime.meaning-invalid', 'Meaning activation options must be an object.');
    const cancelled = abortFailure<MeaningActivationReceipt>(activationOptions.signal);
    if (cancelled !== undefined) return cancelled;
    const entry = get(ref);
    if (entry === undefined) return failure('runtime.meaning-unknown', 'The requested meaning version is not registered.', ['meaning']);
    if (entry.revoked) return failure('runtime.meaning-revoked', 'The requested meaning version has been revoked.', ['meaning']);
    const host: MeaningActivationHost | undefined = options.activationHost;
    if (host === undefined) return failure('runtime.meaning-authority', 'Meaning activation requires a trusted host authority callback.');
    let expected: MeaningActivationOptions['expectedAuthority'];
    if (activationOptions.expectedAuthority !== undefined) {
      const parsed = parseWireValue(activationOptions.expectedAuthority);
      if (!parsed.ok) return failure('runtime.meaning-authority', 'Calling activation authority is malformed.');
      expected = freezeMeaningValue(parsed.value) as unknown as NonNullable<MeaningActivationOptions['expectedAuthority']>;
      if (!validId(expected?.principalKey)) return failure('runtime.meaning-authority', 'Calling activation principal is malformed.');
    }
    const beforeGeneration = generation;
    let before: Outcome<MeaningActivationContext>;
    try {
      before = snapshotContext(await host.readContext({meaning: {id: entry.draft.meaning.id, revision: entry.draft.meaning.revision}, signal: activationOptions.signal ?? new AbortController().signal}));
    } catch {
      return failure('runtime.meaning-authority', 'Meaning activation authority failed safely.');
    }
    if (!before.ok) return before;
    const beforeFailure = contextFailure(before.value, entry.draft.meaning, options.catalog.revision, options.registry.digest);
    if (beforeFailure !== undefined) return beforeFailure;
    if (expected !== undefined && (expected.principalKey !== before.value.principalKey || (expected.readSet !== undefined && canonicalMeaning(expected.readSet) !== canonicalMeaning(before.value.readSet))))
      return failure('runtime.meaning-stale', 'The activation registry does not match the trusted calling authority.');
    if (revokedScopes.has(before.value.scopeDigest)) return failure('runtime.meaning-revoked', 'The activation scope has been revoked.');
    if (activatedOwner !== undefined && (activatedOwner.principalKey !== before.value.principalKey || activatedOwner.scopeDigest !== before.value.scopeDigest))
      return failure('runtime.meaning-scope', 'A meaning registry belongs to one activated principal and scope. Create an isolated registry for a different owner.');
    const approved = activationCandidate(before.value, entry.draft.meaning);
    if (approved === undefined) return failure('runtime.meaning-activation-denied', 'The exact meaning version is not present in the trusted host activation allowlist.', ['meaning']);
    if (canonicalMeaning(approved) !== canonicalMeaning(entry.draft.meaning))
      return failure('runtime.meaning-conflict', 'Activation cannot replace the contents of an immutable registered version. Register a new reviewed version.', ['meaning']);
    if (approved.origin !== entry.draft.meaning.origin) return failure('runtime.meaning-origin', 'Activation cannot erase the meaning origin recorded in the draft.', ['origin']);
    if (approved.lifecycle !== 'active') return failure('runtime.meaning-lifecycle', 'Activation requires a host-approved active definition.', ['lifecycle']);
    const activeDependencies = new Set(definitions({activeOnly: true}).map(meaningRefKey));
    if (approved.dependencies.some((dependency) => !activeDependencies.has(meaningRefKey(dependency))))
      return failure('runtime.meaning-dependency', 'Meaning activation requires every dependency to remain active.', ['dependencies']);
    let candidateCheck: ReturnType<typeof validateMeaningBundle>;
    try {
      candidateCheck = validateMeaningBundle({catalogRevision: options.catalog.revision, functionRegistryDigest: options.registry.digest, meanings: [approved]}, validationOptions());
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
      after = snapshotContext(await host.readContext({meaning: {id: entry.draft.meaning.id, revision: entry.draft.meaning.revision}, signal: activationOptions.signal ?? new AbortController().signal}));
    } catch {
      return failure('runtime.meaning-stale', 'Meaning activation authority could not be rechecked safely.');
    }
    const cancelledBeforePublish = abortFailure<MeaningActivationReceipt>(activationOptions.signal);
    if (cancelledBeforePublish !== undefined) return cancelledBeforePublish;
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
    activatedOwner ??= {principalKey: before.value.principalKey, scopeDigest: before.value.scopeDigest};
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
    const revoked = new Set([key]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [dependentKey, entry] of entries) if (!revoked.has(dependentKey) && entry.draft.meaning.dependencies.some((dependency) => revoked.has(meaningRefKey(dependency)))) {
        revoked.add(dependentKey); changed = true;
      }
    }
    for (const revokedKey of revoked) {
      const entry = entries.get(revokedKey)!;
      entries.set(revokedKey, Object.freeze({draft: entry.draft, active: false, revoked: true}));
      activeScopes.delete(revokedKey);
    }
    generation += 1;
    return {ok: true, value: freezeMeaningValue({state: 'revoked' as const, meaning: {id: prior.draft.meaning.id, revision: prior.draft.meaning.revision}, catalogRevision: options.catalog.revision})};
  };
  const revokeScope = (scopeDigest: string): Outcome<readonly MeaningRevocationReceipt[]> => {
    if (!validId(scopeDigest)) return failure('runtime.meaning-scope', 'The scope digest is malformed.', ['scopeDigest']);
    if (!revokedScopes.has(scopeDigest) && revokedScopes.size >= maxEntries)
      return failure('runtime.meaning-budget', 'The meaning registry scope revocation capacity is exhausted.');
    revokedScopes.add(scopeDigest);
    // Invalidate in-flight activations even if this scope has no active entry yet.
    generation += 1;
    const before = new Set([...entries].filter(([, entry]) => !entry.revoked).map(([key]) => key));
    for (const [key, entry] of entries) if (activeScopes.get(key) === scopeDigest && entry.active) {
      const result = revoke({id: entry.draft.meaning.id, revision: entry.draft.meaning.revision});
      if (!result.ok) return result;
    }
    const receipts: MeaningRevocationReceipt[] = [...entries].filter(([key, entry]) => before.has(key) && entry.revoked).map(([, entry]) => freezeMeaningValue({
      state: 'revoked' as const, meaning: {id: entry.draft.meaning.id, revision: entry.draft.meaning.revision}, catalogRevision: options.catalog.revision,
    }));
    return {ok: true, value: Object.freeze(receipts)};
  };

  const registry: MeaningRegistry = Object.freeze({catalog: options.catalog, registry: options.registry, register, registerBundle, get, list, definitions, activate, revoke, revokeScope});
  return {ok: true, value: registry};
}
