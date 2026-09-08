import {
  parseContract,
  type Catalog,
  type Diagnostic,
  type Experience,
  type FunctionRegistry,
  type MeaningDefinition,
  type Outcome,
  type QueryResult,
  type VersionRef,
} from '@aeliqo/core';
import {
  createMeaningAuthoring,
  createMeaningEvaluator,
  createMeaningRegistry,
  type MeaningDraft,
  type MeaningEvaluationInput,
  type MeaningDiff,
  type MeaningRegistry,
  type MeaningSource,
} from '@aeliqo/runtime/meaning';
import {
  createStudioDocument,
  canonical,
  serializeStudioCode,
  serializeStudioDocument,
  sourceOfMeaning,
  type StudioArea,
  type StudioDocument,
  type StudioDocumentOptions,
  type StudioProfile,
  type StudioPreviewState,
  type StudioTheme,
} from './document.js';

export interface StudioInspection {
  readonly sourceOfTruth: 'application-bundle' | 'studio-draft';
  readonly catalogRevision: string;
  readonly registryDigest: string;
  readonly activeProfile: VersionRef;
  readonly meaningCount: number;
  readonly codeOwnedCount: number;
  readonly studioOwnedCount: number;
  readonly diagnostics: readonly Diagnostic[];
  readonly currentView: {
    readonly area: StudioArea;
    readonly previewState: StudioPreviewState;
    readonly theme: StudioTheme;
  };
}

export interface StudioState {
  readonly document: StudioDocument;
  readonly area: StudioArea;
  readonly previewState: StudioPreviewState;
  readonly selectedMeaning: VersionRef | undefined;
  readonly selectedComponent: string | undefined;
  readonly dirty: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export interface StudioMeaningInput {
  readonly id: string;
  readonly revision?: string;
  readonly label: string;
  readonly description: string;
  readonly entity: string;
  readonly field: string;
  /** The host ignores caller provenance and assigns the Studio source. */
  readonly source?: MeaningSource;
}

export interface StudioExperienceEditInput {
  readonly base: VersionRef;
  readonly label: string;
  readonly experience: Experience;
}

export interface StudioSession {
  readonly getState: () => StudioState;
  readonly inspect: () => StudioInspection;
  readonly subscribe: (listener: (state: StudioState) => void) => () => void;
  readonly selectArea: (area: unknown) => Outcome<void>;
  readonly selectMeaning: (meaning?: VersionRef) => void;
  readonly selectComponent: (component?: string) => void;
  readonly setPreviewState: (state: unknown) => Outcome<void>;
  readonly showDiagnostics: (diagnostics: readonly Diagnostic[]) => void;
  readonly setTheme: (theme: unknown) => Outcome<void>;
  readonly setActiveProfile: (profile: VersionRef) => Outcome<void>;
  readonly defineMeaning: (input: StudioMeaningInput) => Outcome<MeaningDraft>;
  readonly evaluateMeaning: (input: MeaningEvaluationInput) => Outcome<QueryResult>;
  readonly editExperience: (input: StudioExperienceEditInput) => Outcome<StudioProfile>;
  readonly proposeMeaningDiff: (base: VersionRef, candidate: MeaningDefinition) => Outcome<MeaningDiff>;
  readonly applyMeaningDiff: (diff: MeaningDiff) => Outcome<MeaningDraft>;
  readonly importDocument: (input: unknown) => Outcome<StudioDocument>;
  readonly exportDocument: () => Outcome<string>;
  readonly exportCode: () => Outcome<string>;
}

const fail = <T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}],
});

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function isVersionRef(value: unknown): value is VersionRef {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).id === 'string'
    && typeof (value as Record<string, unknown>).revision === 'string';
}

interface MeaningLedgerEntry {
  readonly canonical: string;
  readonly ownership: MeaningSource['ownership'];
}

function cloneState(state: StudioState): StudioState {
  return Object.freeze({...state, diagnostics: Object.freeze([...state.diagnostics])});
}

export function createStudioSession(initial: StudioDocument, options: StudioDocumentOptions & {readonly registry: FunctionRegistry}): StudioSession {
  const checked = createStudioDocument(initial, options);
  if (!checked.ok) throw new TypeError(checked.diagnostics[0]!.message);
  let document = checked.value;
  const revisions = new Map<string, string>([[JSON.stringify([document.id, document.revision]), canonical(document)]]);
  const meaningLedger = new Map<string, MeaningLedgerEntry>();
  let state: StudioState = cloneState({document, area: 'data-meaning', previewState: 'ready', selectedMeaning: undefined, selectedComponent: undefined, dirty: false, diagnostics: []});
  const listeners = new Set<(next: StudioState) => void>();
  const makeMeaningRegistry = (candidate: StudioDocument): Outcome<MeaningRegistry> => {
    const meaningRegistry = createMeaningRegistry({catalog: candidate.catalog, registry: options.registry});
    if (!meaningRegistry.ok) return meaningRegistry;
    // A Studio import may switch the catalog while keeping the same function
    // registry digest. Rebuild the host registry against that catalog and
    // replay the validated drafts; retaining the old closure would validate
    // fields and dependencies against the previous catalog.
    for (const draft of candidate.meanings) {
      const registered = meaningRegistry.value.register({draft});
      if (!registered.ok) return registered;
    }
    return meaningRegistry;
  };
  const meaningsIn = (candidate: StudioDocument): readonly {readonly meaning: MeaningDefinition; readonly source: MeaningSource}[] => [
    ...candidate.catalog.meanings.map((meaning) => ({meaning, source: {surface: 'code' as const, ownership: 'code' as const, readOnly: true}})),
    ...candidate.meanings.map((draft) => ({meaning: draft.meaning, source: draft.source})),
  ];
  const checkMeaningLedger = (candidate: StudioDocument): Outcome<void> => {
    for (const {meaning, source} of meaningsIn(candidate)) {
      const key = JSON.stringify([meaning.id, meaning.revision]);
      const next = {canonical: canonical(meaning), ownership: source.ownership};
      const prior = meaningLedger.get(key);
      if (prior === undefined) continue;
      if (prior.canonical !== next.canonical) return fail<void>('studio.meaning-conflict', 'An immutable meaning ID and revision has different canonical contents from an earlier accepted document.', ['meanings', meaning.id, meaning.revision]);
      if (prior.ownership !== next.ownership) return fail<void>('studio.meaning-source-conflict', 'A meaning cannot silently change ownership or authoring surface.', ['meanings', meaning.id, meaning.revision, 'source']);
    }
    return {ok: true, value: undefined};
  };
  const recordMeaningLedger = (candidate: StudioDocument): void => {
    for (const {meaning, source} of meaningsIn(candidate)) {
      meaningLedger.set(JSON.stringify([meaning.id, meaning.revision]), {canonical: canonical(meaning), ownership: source.ownership});
    }
  };
  recordMeaningLedger(document);
  const initialRegistry = makeMeaningRegistry(document);
  if (!initialRegistry.ok) throw new TypeError(initialRegistry.diagnostics[0]!.message);
  let registry = initialRegistry.value;
  const notify = (): void => listeners.forEach((listener) => listener(state));
  const setState = (next: Partial<StudioState>): void => {
    state = cloneState({...state, ...next, document});
    notify();
  };
  const withDocument = (next: StudioDocument, dirty = true): void => {
    document = next;
    revisions.set(JSON.stringify([document.id, document.revision]), canonical(document));
    state = cloneState({...state, document, dirty});
    notify();
  };
  const reject = (code: string, message: string, path: readonly (string | number)[]): Outcome<void> => {
    const result = fail<void>(code, message, path);
    setState({diagnostics: result.ok ? [] : result.diagnostics});
    return result;
  };
  const createAuthoring = () => createMeaningAuthoring({catalog: document.catalog, registry: options.registry, definitions: [...document.catalog.meanings, ...document.meanings.map((entry) => entry.meaning)]});
  const defineMeaning = (input: unknown): Outcome<MeaningDraft> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return fail('studio.meaning-input', 'Meaning authoring input must be an object.', ['input']);
    const candidate = input as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string' || typeof candidate.description !== 'string' || typeof candidate.entity !== 'string' || typeof candidate.field !== 'string')
      return fail('studio.meaning-input', 'Meaning authoring requires bounded id, label, description, entity and field text.', ['input']);
    if (candidate.revision !== undefined && typeof candidate.revision !== 'string') return fail('studio.meaning-input', 'Meaning revision must be text when supplied.', ['input', 'revision']);
    // A Studio caller cannot assert a trusted code or workspace provenance.
    // Built-in code meanings enter through the catalog; this path only creates
    // a personal Studio draft.
    if (candidate.source !== undefined) {
      if (candidate.source === null || typeof candidate.source !== 'object' || Array.isArray(candidate.source)) return fail('studio.meaning-source-untrusted', 'Studio authoring source must be omitted; provenance is assigned by the host.', ['input', 'source']);
      const source = candidate.source as Record<string, unknown>;
      if (source.surface !== 'studio' || source.ownership !== 'personal' || source.readOnly === true) return fail('studio.meaning-source-untrusted', 'Studio authoring cannot self-declare code, workspace or read-only provenance.', ['input', 'source']);
    }
    const typed = candidate as {readonly id: string; readonly revision?: string; readonly label: string; readonly description: string; readonly entity: string; readonly field: string};
    const authoring = createAuthoring();
    if (!authoring.ok) return authoring;
    const field = authoring.value.field(typed.entity, typed.field);
    if (!field.ok) return field;
    const expression = authoring.value.call({id: 'core.aggregate.sum', revision: '1'}, [field]);
    if (!expression.ok) return expression;
    const draft = authoring.value.defineMeaning({
      id: typed.id,
      ...(typed.revision === undefined ? {} : {revision: typed.revision}),
      label: typed.label,
      description: typed.description,
      expression,
    });
    if (!draft.ok) return draft;
    const normalized = authoring.value.draft(draft.value.meaning, {source: {surface: 'studio', ownership: 'personal'}, assumptions: []});
    if (!normalized.ok) return normalized;
    const existingMeaning = document.meanings.find((entry) => sameRef(entry.meaning, normalized.value.meaning))
      ?? document.catalog.meanings.find((entry) => sameRef(entry, normalized.value.meaning));
    const ledgerEntry = meaningLedger.get(JSON.stringify([normalized.value.meaning.id, normalized.value.meaning.revision]));
    if (ledgerEntry !== undefined && (ledgerEntry.canonical !== canonical(normalized.value.meaning) || ledgerEntry.ownership === 'code')) {
      return fail('studio.meaning-conflict', 'The meaning ID and revision is already owned by an immutable canonical definition; create a new revision.', ['meaning']);
    }
    if (existingMeaning !== undefined && sourceOfMeaning(document, normalized.value.meaning)?.ownership === 'code') {
      return fail('studio.meaning-read-only', 'Code-owned meanings are read-only; create a new revision or propose a diff.', ['meaning']);
    }
    const registration = registry.register({draft: normalized.value});
    if (!registration.ok) return registration;
    const existing = document.meanings.filter((entry) => !sameRef(entry.meaning, normalized.value.meaning));
    withDocument({...document, revision: `${document.revision}-meaning`, meanings: [...existing, normalized.value]}, true);
    setState({area: 'data-meaning', selectedMeaning: {id: normalized.value.meaning.id, revision: normalized.value.meaning.revision}, diagnostics: []});
    return {ok: true, value: normalized.value};
  };
  const evaluateMeaning = (input: unknown): Outcome<QueryResult> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return fail('studio.meaning-evaluation', 'Meaning evaluation input must be an object.', ['input']);
    const evaluator = createMeaningEvaluator({catalog: document.catalog, registry: options.registry, definitions: [...document.catalog.meanings, ...document.meanings.map((entry) => entry.meaning)]});
    if (!evaluator.ok) return evaluator;
    return evaluator.value.evaluate(input as MeaningEvaluationInput);
  };
  const editExperience = (input: unknown): Outcome<StudioProfile> => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return fail('studio.experience-input', 'Experience edit input must be an object.', ['input']);
    const candidate = input as Record<string, unknown>;
    if (candidate.base === null || typeof candidate.base !== 'object' || Array.isArray(candidate.base)) return fail('studio.experience-input', 'Experience edits require a base profile reference.', ['input', 'base']);
    const base = candidate.base as Record<string, unknown>;
    if (typeof base.id !== 'string' || typeof base.revision !== 'string') return fail('studio.experience-input', 'Experience base must be a version reference.', ['input', 'base']);
    const baseRef = {id: base.id, revision: base.revision};
    const prior = document.profiles.find((entry) => sameRef(entry.experience, baseRef));
    if (prior === undefined) return fail('studio.experience-unknown', 'The selected Experience profile is not in this document.', ['input', 'base']);
    if (typeof candidate.label !== 'string' || candidate.label.length === 0 || candidate.label.length > 256) return fail('studio.experience-input', 'Experience label must be bounded text.', ['input', 'label']);
    const parsed = parseContract('experience', candidate.experience);
    if (!parsed.ok) return {ok: false, diagnostics: parsed.diagnostics.map((diagnostic) => ({...diagnostic, path: ['input', 'experience', ...(diagnostic.path ?? [])]})) as unknown as [Diagnostic, ...Diagnostic[]]};
    const experience = parsed.value as Experience;
    const sameIdentity = sameRef(experience, prior.experience);
    if (sameIdentity && prior.source.ownership === 'code') return fail('studio.experience-read-only', 'Code-owned Experience profiles are read-only; create a new revision for a Studio edit.', ['input', 'experience']);
    if (sameIdentity && canonical(experience) === canonical(prior.experience) && candidate.label === prior.label) return {ok: true, value: prior};
    if (sameIdentity && canonical(experience) === canonical(prior.experience)) return fail('studio.experience-conflict', 'An immutable Experience profile revision cannot change its label; create a new revision.', ['input', 'label']);
    if (sameIdentity && canonical(experience) !== canonical(prior.experience)) return fail('studio.experience-conflict', 'An immutable Experience ID and revision cannot change canonical contents; create a new revision.', ['input', 'experience']);
    const collision = document.profiles.find((entry) => sameRef(entry.experience, experience) && canonical(entry.experience) !== canonical(experience));
    if (collision !== undefined) return fail('studio.experience-conflict', 'The proposed Experience revision conflicts with an existing profile.', ['input', 'experience']);
    const nextProfile: StudioProfile = Object.freeze({label: candidate.label as string, source: {surface: 'studio' as const, ownership: 'personal' as const}, experience});
    const profiles = document.profiles.filter((entry) => !sameRef(entry.experience, prior.experience));
    profiles.push(nextProfile);
    const next = {...document, revision: `${document.revision}-experience`, profiles: Object.freeze(profiles), activeProfile: sameRef(document.activeProfile, prior.experience) ? {id: experience.id, revision: experience.revision} : document.activeProfile};
    const checked = createStudioDocument(next, options);
    if (!checked.ok) return {ok: false, diagnostics: checked.diagnostics};
    withDocument(checked.value, true);
    setState({area: 'experience', diagnostics: []});
    return {ok: true, value: nextProfile};
  };
  const proposeMeaningDiff = (base: unknown, candidate: unknown): Outcome<MeaningDiff> => {
    if (!isVersionRef(base)) return fail('studio.meaning-input', 'Meaning diff requires a canonical base reference.', ['base']);
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return fail('studio.meaning-input', 'Meaning diff candidate must be an object.', ['candidate']);
    const source = sourceOfMeaning(document, base);
    if (source?.ownership === 'code') {
      const authoring = createAuthoring();
      if (!authoring.ok) return authoring;
      const prior = document.meanings.find((entry) => sameRef(entry.meaning, base)) ?? document.catalog.meanings.find((entry) => sameRef(entry, base));
      if (prior === undefined) return fail('studio.meaning-unknown', 'The selected meaning is not present in this document.', ['meaning']);
      return authoring.value.proposeDiff(prior, candidate as MeaningDefinition);
    }
    const authoring = createAuthoring();
    if (!authoring.ok) return authoring;
    const prior = document.meanings.find((entry) => sameRef(entry.meaning, base));
    if (prior === undefined) return fail('studio.meaning-unknown', 'The selected meaning is not present in this document.', ['meaning']);
    return authoring.value.proposeDiff(prior, candidate as MeaningDefinition);
  };
  const applyMeaningDiff = (diff: unknown): Outcome<MeaningDraft> => {
    if (diff === null || typeof diff !== 'object' || Array.isArray(diff)) return fail('studio.meaning-diff', 'Meaning diff must be an object.', ['diff']);
    const candidate = diff as Record<string, unknown>;
    if (candidate.state !== 'proposed-diff' || candidate.base === null || typeof candidate.base !== 'object' || Array.isArray(candidate.base) || candidate.candidate === null || typeof candidate.candidate !== 'object' || Array.isArray(candidate.candidate)) return fail('studio.meaning-diff', 'Meaning diff must contain a proposed base and candidate.', ['diff']);
    const baseDraft = candidate.base as Record<string, unknown>;
    const baseMeaning = baseDraft.meaning;
    if (baseMeaning === null || typeof baseMeaning !== 'object' || Array.isArray(baseMeaning) || !isVersionRef(baseMeaning)) return fail('studio.meaning-diff', 'Meaning diff base must contain a canonical definition.', ['diff', 'base']);
    const baseRef = {id: (baseMeaning as MeaningDefinition).id, revision: (baseMeaning as MeaningDefinition).revision};
    const currentDraft = document.meanings.find((entry) => sameRef(entry.meaning, baseRef));
    const current = currentDraft?.meaning ?? document.catalog.meanings.find((entry) => sameRef(entry, baseRef));
    if (current === undefined) return fail('studio.meaning-unknown', 'The proposed diff base is no longer present in this document.', ['diff', 'base']);
    if (canonical(current) !== canonical(baseMeaning)) return fail('studio.meaning-stale', 'The proposed meaning diff is stale because its base changed.', ['diff', 'base']);
    const proposed = candidate.candidate as Record<string, unknown>;
    const proposedMeaning = proposed.meaning;
    if (proposedMeaning === null || typeof proposedMeaning !== 'object' || Array.isArray(proposedMeaning)) return fail('studio.meaning-diff', 'Meaning diff candidate must contain a canonical definition.', ['diff', 'candidate']);
    const candidateValue = proposedMeaning as MeaningDefinition;
    if (sameRef(candidateValue, baseRef)) return fail('studio.meaning-conflict', 'Applying a diff requires a new meaning revision or identity; code-owned content remains immutable.', ['diff', 'candidate', 'meaning']);
    const authoring = createAuthoring();
    if (!authoring.ok) return authoring;
    const next = authoring.value.draft(candidateValue, {source: {surface: 'studio', ownership: 'personal'}, assumptions: [] , base: baseRef});
    if (!next.ok) return next;
    const existing = document.meanings.find((entry) => sameRef(entry.meaning, next.value.meaning));
    if (existing !== undefined && canonical(existing.meaning) !== canonical(next.value.meaning)) return fail('studio.meaning-conflict', 'The proposed meaning revision conflicts with an existing Studio definition.', ['diff', 'candidate', 'meaning']);
    const registration = registry.register({draft: next.value});
    if (!registration.ok) return registration;
    const meanings = document.meanings.filter((entry) => !sameRef(entry.meaning, next.value.meaning));
    meanings.push(next.value);
    withDocument({...document, revision: `${document.revision}-meaning-diff`, meanings}, true);
    setState({area: 'data-meaning', selectedMeaning: {id: next.value.meaning.id, revision: next.value.meaning.revision}, diagnostics: []});
    return next;
  };
  const importDocument = (input: unknown): Outcome<StudioDocument> => {
    const next = createStudioDocument(input as never, options);
    if (!next.ok) {
      setState({diagnostics: next.diagnostics});
      return next;
    }
    // A loaded code bundle remains the source of truth. Studio can replace its
    // draft document only when the incoming immutable revision is explicit.
    const identity = JSON.stringify([next.value.id, next.value.revision]);
    const prior = revisions.get(identity);
    if (prior !== undefined && prior !== canonical(next.value)) {
      const conflict = fail<StudioDocument>('studio.source-conflict', 'A document with the same identity and revision has different canonical contents.', ['revision']);
      if (!conflict.ok) setState({diagnostics: conflict.diagnostics});
      return conflict;
    }
    const ledgerCheck = checkMeaningLedger(next.value);
    if (!ledgerCheck.ok) {
      setState({diagnostics: ledgerCheck.diagnostics});
      return ledgerCheck;
    }
    const nextRegistry = makeMeaningRegistry(next.value);
    if (!nextRegistry.ok) {
      setState({diagnostics: nextRegistry.diagnostics});
      return nextRegistry;
    }
    registry = nextRegistry.value;
    recordMeaningLedger(next.value);
    withDocument(next.value, false);
    setState({diagnostics: [], selectedMeaning: undefined, area: 'inspect'});
    return next;
  };
  return Object.freeze({
    getState: () => state,
    inspect: () => {
      const allMeanings = [...document.catalog.meanings, ...document.meanings.map((entry) => entry.meaning)];
      const codeOwnedCount = allMeanings.filter((meaning) => sourceOfMeaning(document, meaning)?.ownership === 'code').length;
      return Object.freeze({sourceOfTruth: document.meanings.length > 0 ? 'studio-draft' as const : 'application-bundle' as const,
        catalogRevision: document.catalog.revision, registryDigest: document.catalog.functionRegistryDigest,
        activeProfile: document.activeProfile, meaningCount: allMeanings.length,
        codeOwnedCount, studioOwnedCount: allMeanings.length - codeOwnedCount, diagnostics: state.diagnostics,
        currentView: {area: state.area, previewState: state.previewState, theme: document.tokens.theme}});
    },
    subscribe: (listener: (next: StudioState) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    selectArea: (area: unknown): Outcome<void> => {
      if (area !== 'data-meaning' && area !== 'experience' && area !== 'gallery' && area !== 'inspect') return reject('studio.area-invalid', 'Studio area is unsupported.', ['area']);
      setState({area});
      return {ok: true, value: undefined};
    },
    selectMeaning: (meaning: VersionRef | undefined) => setState({selectedMeaning: meaning}),
    selectComponent: (component: string | undefined) => setState({selectedComponent: component}),
    setPreviewState: (previewState: unknown): Outcome<void> => {
      if (previewState !== 'ready' && previewState !== 'loading' && previewState !== 'empty' && previewState !== 'partial' && previewState !== 'stale' && previewState !== 'error') return reject('studio.preview-state-invalid', 'Studio preview state is unsupported.', ['previewState']);
      setState({previewState});
      return {ok: true, value: undefined};
    },
    showDiagnostics: (diagnostics: readonly Diagnostic[]) => setState({diagnostics}),
    setTheme: (theme: unknown): Outcome<void> => {
      if (theme !== 'light' && theme !== 'dark') return reject('studio.theme-invalid', 'Studio theme is unsupported.', ['theme']);
      withDocument({...document, revision: `${document.revision}-theme`, tokens: {...document.tokens, theme}}, true);
      return {ok: true, value: undefined};
    },
    setActiveProfile: (profile: unknown): Outcome<void> => {
      if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return reject('studio.profile-invalid', 'The selected Experience profile reference is malformed.', ['activeProfile']);
      const candidate = profile as Record<string, unknown>;
      if (typeof candidate.id !== 'string' || typeof candidate.revision !== 'string') return reject('studio.profile-invalid', 'The selected Experience profile reference is malformed.', ['activeProfile']);
      const ref = {id: candidate.id, revision: candidate.revision};
      if (!document.profiles.some((entry) => sameRef(entry.experience, ref))) return reject('studio.profile-unknown', 'The selected Experience profile is not in this document.', ['activeProfile']);
      withDocument({...document, revision: `${document.revision}-profile`, activeProfile: ref}, true);
      return {ok: true, value: undefined};
    },
    defineMeaning,
    evaluateMeaning,
    editExperience,
    proposeMeaningDiff,
    applyMeaningDiff,
    importDocument,
    exportDocument: () => serializeStudioDocument(document, options),
    exportCode: () => serializeStudioCode(document, options),
  });
}

export type {Catalog, Experience, FunctionRegistry, MeaningDefinition, Outcome, VersionRef};
