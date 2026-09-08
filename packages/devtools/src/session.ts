import {
  type Catalog,
  type Diagnostic,
  type Experience,
  type FunctionRegistry,
  type MeaningDefinition,
  type Outcome,
  type VersionRef,
} from '@aeliqo/core';
import {
  createMeaningAuthoring,
  createMeaningRegistry,
  type MeaningDraft,
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

export interface StudioSession {
  readonly getState: () => StudioState;
  readonly inspect: () => StudioInspection;
  readonly subscribe: (listener: (state: StudioState) => void) => () => void;
  readonly selectArea: (area: StudioArea) => void;
  readonly selectMeaning: (meaning?: VersionRef) => void;
  readonly selectComponent: (component?: string) => void;
  readonly setPreviewState: (state: StudioPreviewState) => void;
  readonly showDiagnostics: (diagnostics: readonly Diagnostic[]) => void;
  readonly setTheme: (theme: StudioTheme) => void;
  readonly setActiveProfile: (profile: VersionRef) => Outcome<void>;
  readonly defineMeaning: (input: {
    readonly id: string;
    readonly revision?: string;
    readonly label: string;
    readonly description: string;
    readonly entity: string;
    readonly field: string;
    readonly source?: MeaningSource;
  }) => Outcome<MeaningDraft>;
  readonly proposeMeaningDiff: (base: VersionRef, candidate: MeaningDefinition) => Outcome<{readonly base: MeaningDraft; readonly candidate: MeaningDraft; readonly changed: readonly string[]}>;
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

function cloneState(state: StudioState): StudioState {
  return Object.freeze({...state, diagnostics: Object.freeze([...state.diagnostics])});
}

export function createStudioSession(initial: StudioDocument, options: StudioDocumentOptions & {readonly registry: FunctionRegistry}): StudioSession {
  const checked = createStudioDocument(initial, options);
  if (!checked.ok) throw new TypeError(checked.diagnostics[0]!.message);
  let document = checked.value;
  const revisions = new Map<string, string>([[JSON.stringify([document.id, document.revision]), canonical(document)]]);
  let state: StudioState = cloneState({document, area: 'data-meaning', previewState: 'ready', selectedMeaning: undefined, selectedComponent: undefined, dirty: false, diagnostics: []});
  const listeners = new Set<(next: StudioState) => void>();
  const meaningRegistry = createMeaningRegistry({catalog: document.catalog, registry: options.registry});
  if (!meaningRegistry.ok) throw new TypeError(meaningRegistry.diagnostics[0]!.message);
  const registry = meaningRegistry.value;
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
  const createAuthoring = () => createMeaningAuthoring({catalog: document.catalog, registry: options.registry, definitions: [...document.catalog.meanings, ...document.meanings.map((entry) => entry.meaning)]});
  const defineMeaning = (input: Parameters<StudioSession['defineMeaning']>[0]): Outcome<MeaningDraft> => {
    const authoring = createAuthoring();
    if (!authoring.ok) return authoring;
    const field = authoring.value.field(input.entity, input.field);
    if (!field.ok) return field;
    const draft = authoring.value.defineMeaning({
      id: input.id,
      ...(input.revision === undefined ? {} : {revision: input.revision}),
      label: input.label,
      description: input.description,
      expression: field,
    });
    if (!draft.ok) return draft;
    const normalized = authoring.value.draft(draft.value.meaning, {source: input.source ?? {surface: 'studio', ownership: 'personal'}, assumptions: []});
    if (!normalized.ok) return normalized;
    const existingMeaning = document.meanings.find((entry) => sameRef(entry.meaning, normalized.value.meaning))
      ?? document.catalog.meanings.find((entry) => sameRef(entry, normalized.value.meaning));
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
  const proposeMeaningDiff = (base: VersionRef, candidate: MeaningDefinition): Outcome<{readonly base: MeaningDraft; readonly candidate: MeaningDraft; readonly changed: readonly string[]}> => {
    const source = sourceOfMeaning(document, base);
    if (source?.ownership === 'code') {
      const authoring = createAuthoring();
      if (!authoring.ok) return authoring;
      const prior = document.meanings.find((entry) => sameRef(entry.meaning, base)) ?? document.catalog.meanings.find((entry) => sameRef(entry, base));
      if (prior === undefined) return fail('studio.meaning-unknown', 'The selected meaning is not present in this document.', ['meaning']);
      return authoring.value.proposeDiff(prior, candidate);
    }
    const authoring = createAuthoring();
    if (!authoring.ok) return authoring;
    const prior = document.meanings.find((entry) => sameRef(entry.meaning, base));
    if (prior === undefined) return fail('studio.meaning-unknown', 'The selected meaning is not present in this document.', ['meaning']);
    return authoring.value.proposeDiff(prior, candidate);
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
    if (prior !== undefined && prior !== canonical(next.value)) return fail('studio.source-conflict', 'A document with the same identity and revision has different canonical contents.', ['revision']);
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
    selectArea: (area: StudioArea) => setState({area}),
    selectMeaning: (meaning: VersionRef | undefined) => setState({selectedMeaning: meaning}),
    selectComponent: (component: string | undefined) => setState({selectedComponent: component}),
    setPreviewState: (previewState: StudioPreviewState) => setState({previewState}),
    showDiagnostics: (diagnostics: readonly Diagnostic[]) => setState({diagnostics}),
    setTheme: (theme: StudioTheme) => withDocument({...document, revision: `${document.revision}-theme`, tokens: {...document.tokens, theme}}, true),
    setActiveProfile: (profile: VersionRef): Outcome<void> => {
      if (!document.profiles.some((candidate) => sameRef(candidate.experience, profile))) return fail<void>('studio.profile-unknown', 'The selected Experience profile is not in this document.', ['activeProfile']);
      withDocument({...document, revision: `${document.revision}-profile`, activeProfile: {...profile}}, true);
      return {ok: true, value: undefined};
    },
    defineMeaning,
    proposeMeaningDiff,
    importDocument,
    exportDocument: () => serializeStudioDocument(document, options),
    exportCode: () => serializeStudioCode(document, options),
  });
}

export type {Catalog, Experience, FunctionRegistry, MeaningDefinition, Outcome, VersionRef};
