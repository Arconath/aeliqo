import {
  parseCatalog,
  parseContract,
  parseWireValue,
  validateMeaningBundle,
  type Catalog,
  type Diagnostic,
  type Experience,
  type FunctionRegistry,
  type MeaningDefinition,
  type Outcome,
  type VersionRef,
} from '@aeliqo/core';
import {
  createMeaningDraft,
  meaningDigest,
  type MeaningDraft,
  type MeaningSource,
} from '@aeliqo/runtime/meaning';

export type StudioArea = 'data-meaning' | 'experience' | 'gallery' | 'inspect';
export type StudioTheme = 'light' | 'dark';
export type StudioPreviewState = 'ready' | 'loading' | 'empty' | 'partial' | 'stale' | 'error';

export interface StudioTokens {
  readonly profile: VersionRef;
  readonly theme: StudioTheme;
}

export interface StudioProfile {
  readonly label: string;
  readonly source: MeaningSource;
  readonly experience: Experience;
}

/** The versioned document shared by Studio and code/config authoring. */
export interface StudioDocument {
  readonly version: '1';
  readonly id: string;
  readonly revision: string;
  readonly catalog: Catalog;
  readonly meanings: readonly MeaningDraft[];
  readonly profiles: readonly StudioProfile[];
  readonly activeProfile: VersionRef;
  readonly tokens: StudioTokens;
}

export interface StudioDocumentOptions {
  readonly registry: FunctionRegistry;
}

export interface StudioDocumentInput {
  readonly version?: unknown;
  readonly id?: unknown;
  readonly revision?: unknown;
  readonly catalog?: unknown;
  readonly meanings?: unknown;
  readonly profiles?: unknown;
  readonly activeProfile?: unknown;
  readonly tokens?: unknown;
}

const fail = <T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false, ...(path === undefined ? {} : {path: [...path]})}],
});

function text(value: unknown, name: string): Outcome<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(value)
    ? {ok: true, value}
    : fail('studio.invalid-text', `${name} must be bounded text.`, [name]);
}

function ref(value: unknown, name: string): Outcome<VersionRef> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('studio.invalid-reference', `${name} must be a version reference.`, [name]);
  const candidate = value as Record<string, unknown>;
  const id = text(candidate.id, `${name}.id`);
  if (!id.ok) return id;
  const revision = text(candidate.revision, `${name}.revision`);
  if (!revision.ok) return revision;
  if (Object.keys(candidate).some((key) => key !== 'id' && key !== 'revision')) return fail('studio.invalid-reference', `${name} contains an unknown property.`, [name]);
  return {ok: true, value: Object.freeze({id: id.value, revision: revision.value})};
}

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function refKey(value: VersionRef): string {
  return JSON.stringify([value.id, value.revision]);
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function freeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach((child) => freeze(child));
    return Object.freeze(value);
  }
  Object.values(value as Record<string, unknown>).forEach((child) => freeze(child));
  return Object.freeze(value);
}

function normalizeSource(value: unknown, path: readonly (string | number)[]): Outcome<MeaningSource> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('studio.meaning-source', 'Meaning source must be a bounded object.', path);
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !['surface', 'ownership', 'readOnly', 'ownerId'].includes(key))) return fail('studio.meaning-source', 'Meaning source contains an unknown property.', path);
  if (!['code', 'studio', 'ai-assisted'].includes(String(candidate.surface)) || !['code', 'session', 'personal', 'workspace', 'organization'].includes(String(candidate.ownership)))
    return fail('studio.meaning-source', 'Meaning source surface or ownership is unsupported.', path);
  if (candidate.readOnly !== undefined && typeof candidate.readOnly !== 'boolean') return fail('studio.meaning-source', 'Meaning source readOnly must be boolean.', [...path, 'readOnly']);
  if (candidate.ownerId !== undefined) {
    const ownerId = text(candidate.ownerId, 'ownerId');
    if (!ownerId.ok) return fail('studio.meaning-source', 'Meaning source ownerId is invalid.', [...path, 'ownerId']);
  }
  const source = {
    surface: candidate.surface as MeaningSource['surface'],
    ownership: candidate.ownership as MeaningSource['ownership'],
    ...(candidate.readOnly === undefined ? {} : {readOnly: candidate.readOnly}),
    ...(candidate.ownerId === undefined ? {} : {ownerId: candidate.ownerId as string}),
  } satisfies MeaningSource;
  return {ok: true, value: freeze(source)};
}

function normalizeDraft(value: unknown, options: StudioDocumentOptions, catalog: Catalog, index: number, definitions: readonly MeaningDefinition[]): Outcome<MeaningDraft> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('studio.meaning-draft', 'Meaning entries must be versioned drafts.', ['meanings', index]);
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== '1') return fail('studio.meaning-draft', 'Meaning draft version is unsupported.', ['meanings', index, 'version']);
  const source = normalizeSource(candidate.source, ['meanings', index, 'source']);
  if (!source.ok) return source;
  const meaning = candidate.meaning;
  const assumptions = candidate.assumptions;
  if (!Array.isArray(assumptions) || assumptions.some((entry) => typeof entry !== 'string' || entry.length > 512)) return fail('studio.meaning-draft', 'Meaning assumptions must be bounded text.', ['meanings', index, 'assumptions']);
  const authoring = createMeaningDraft(meaning as MeaningDefinition, {catalog, registry: options.registry, definitions}, {
    source: source.value,
    assumptions: assumptions as readonly string[],
    ...(candidate.base === undefined ? {} : {base: candidate.base as VersionRef}),
  });
  if (!authoring.ok) return {ok: false, diagnostics: authoring.diagnostics.map((diagnostic) => ({...diagnostic, path: ['meanings', index, ...(diagnostic.path ?? [])]})) as unknown as [Diagnostic, ...Diagnostic[]]};
  if (candidate.digest !== authoring.value.digest) return fail('studio.meaning-digest', 'Meaning draft digest does not match its canonical contents.', ['meanings', index, 'digest']);
  return {ok: true, value: authoring.value};
}

function normalizeProfile(value: unknown, index: number): Outcome<StudioProfile> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('studio.profile', 'Experience profiles must be objects.', ['profiles', index]);
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !['label', 'source', 'experience'].includes(key))) return fail('studio.profile', 'Experience profile contains an unknown property.', ['profiles', index]);
  const label = text(candidate.label, `profiles.${index}.label`);
  if (!label.ok) return label;
  const source = normalizeSource(candidate.source, ['profiles', index, 'source']);
  if (!source.ok) return source;
  const experience = parseContract('experience', candidate.experience);
  if (!experience.ok) return {ok: false, diagnostics: experience.diagnostics.map((diagnostic) => ({...diagnostic, path: ['profiles', index, 'experience', ...(diagnostic.path ?? [])]})) as unknown as [Diagnostic, ...Diagnostic[]]};
  return {ok: true, value: freeze({label: label.value, source: source.value, experience: experience.value})};
}

function validateDocument(value: unknown, options: StudioDocumentOptions): Outcome<StudioDocument> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('studio.document', 'Studio document must be a plain object.');
  const candidate = value as StudioDocumentInput;
  if (Object.keys(candidate as Record<string, unknown>).some((key) => !['version', 'id', 'revision', 'catalog', 'meanings', 'profiles', 'activeProfile', 'tokens'].includes(key))) return fail('studio.document', 'Studio document contains an unknown property.');
  if (candidate.version !== '1') return fail('studio.version', 'Studio document version is unsupported.', ['version']);
  const id = text(candidate.id, 'id');
  if (!id.ok) return id;
  const revision = text(candidate.revision, 'revision');
  if (!revision.ok) return revision;
  const catalogResult = parseCatalog(candidate.catalog);
  if (!catalogResult.ok) return {ok: false, diagnostics: catalogResult.diagnostics.map((diagnostic) => ({...diagnostic, path: ['catalog', ...(diagnostic.path ?? [])]})) as unknown as [Diagnostic, ...Diagnostic[]]};
  const catalog = catalogResult.value;
  if (catalog.functionRegistryDigest !== options.registry.digest) return fail('studio.registry-stale', 'The function registry does not match the catalog pin.', ['catalog', 'functionRegistryDigest']);
  if (!Array.isArray(candidate.meanings) || candidate.meanings.length > 512) return fail('studio.meanings', 'Studio meaning drafts must be a bounded array.', ['meanings']);
  const rawMeanings: MeaningDefinition[] = [];
  const rawRefs = new Map<string, string>();
  for (let index = 0; index < candidate.meanings.length; index += 1) {
    const entry = candidate.meanings[index];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return fail('studio.meaning-draft', 'Meaning entries must be versioned drafts.', ['meanings', index]);
    const draft = entry as Record<string, unknown>;
    if (draft.version !== '1') return fail('studio.meaning-draft', 'Meaning draft version is unsupported.', ['meanings', index, 'version']);
    if (draft.meaning === null || typeof draft.meaning !== 'object' || Array.isArray(draft.meaning)) return fail('studio.meaning-draft', 'Meaning draft contents must be an object.', ['meanings', index, 'meaning']);
    const rawMeaning = draft.meaning as MeaningDefinition;
    const rawId = rawMeaning.id;
    const rawRevision = rawMeaning.revision;
    if (typeof rawId === 'string' && typeof rawRevision === 'string') {
      const key = JSON.stringify([rawId, rawRevision]);
      const digest = canonical(rawMeaning);
      const prior = rawRefs.get(key);
      if (prior !== undefined) return fail(prior === digest ? 'studio.meaning-duplicate' : 'studio.meaning-conflict', 'A meaning ID and revision may occur only once in a Studio document.', ['meanings', index, 'meaning']);
      rawRefs.set(key, digest);
    }
    rawMeanings.push(rawMeaning);
  }
  const meaningBundle = validateMeaningBundle({catalogRevision: catalog.revision, functionRegistryDigest: options.registry.digest, meanings: rawMeanings}, {catalog, registry: options.registry, definitions: catalog.meanings});
  if (!meaningBundle.ok) return meaningBundle;
  const indexedDefinitions = [...catalog.meanings, ...meaningBundle.value.meanings];
  const drafts: MeaningDraft[] = [];
  for (let index = 0; index < candidate.meanings.length; index += 1) {
    const draft = normalizeDraft(candidate.meanings[index], options, catalog, index, indexedDefinitions);
    if (!draft.ok) return draft;
    const codeMeaning = catalog.meanings.find((meaning) => sameRef(meaning, draft.value.meaning));
    if (codeMeaning !== undefined) {
      return fail(meaningDigest(draft.value.meaning) === meaningDigest(codeMeaning) ? 'studio.meaning-duplicate' : 'studio.meaning-conflict', 'A document draft cannot shadow a catalog-owned meaning version.', ['meanings', index, 'meaning']);
    }
    drafts.push(draft.value);
  }
  if (!Array.isArray(candidate.profiles) || candidate.profiles.length === 0 || candidate.profiles.length > 64) return fail('studio.profiles', 'Studio requires at least one bounded Experience profile.', ['profiles']);
  const profiles: StudioProfile[] = [];
  const profileRefs = new Set<string>();
  for (let index = 0; index < candidate.profiles.length; index += 1) {
    const profile = normalizeProfile(candidate.profiles[index], index);
    if (!profile.ok) return profile;
    const key = refKey(profile.value.experience);
    if (profileRefs.has(key)) return fail('studio.profile-conflict', 'Experience profile IDs and revisions must be unique.', ['profiles', index, 'experience']);
    profileRefs.add(key);
    profiles.push(profile.value);
  }
  const activeProfile = ref(candidate.activeProfile, 'activeProfile');
  if (!activeProfile.ok) return activeProfile;
  if (!profiles.some((profile) => sameRef(profile.experience, activeProfile.value))) return fail('studio.active-profile', 'The active profile is not present in the document.', ['activeProfile']);
  if (candidate.tokens === null || typeof candidate.tokens !== 'object' || Array.isArray(candidate.tokens)) return fail('studio.tokens', 'Studio tokens must be an object.', ['tokens']);
  const tokens = candidate.tokens as Record<string, unknown>;
  if (Object.keys(tokens).some((key) => !['profile', 'theme'].includes(key))) return fail('studio.tokens', 'Studio tokens contain an unknown property.', ['tokens']);
  const tokenProfile = ref(tokens.profile, 'tokens.profile');
  if (!tokenProfile.ok) return tokenProfile;
  const theme = tokens.theme;
  if (theme !== 'light' && theme !== 'dark') return fail('studio.tokens', 'Studio theme must be light or dark.', ['tokens', 'theme']);
  const document: StudioDocument = {
    version: '1', id: id.value, revision: revision.value, catalog,
    meanings: freeze(drafts), profiles: freeze(profiles), activeProfile: activeProfile.value,
    tokens: freeze({profile: tokenProfile.value, theme}),
  };
  return {ok: true, value: freeze(document)};
}

export function createStudioDocument(input: StudioDocumentInput, options: StudioDocumentOptions): Outcome<StudioDocument> {
  try {
    const wire = parseWireValue(input);
    return wire.ok ? validateDocument(wire.value, options) : wire;
  } catch {
    return fail('studio.document', 'Studio document validation failed safely.');
  }
}

export function parseStudioDocument(input: unknown, options: StudioDocumentOptions): Outcome<StudioDocument> {
  if (typeof input === 'string') {
    if (input.length > 2_000_000) return fail('studio.document-size', 'Studio document exceeds the local export limit.');
    try {
      return createStudioDocument(JSON.parse(input) as StudioDocumentInput, options);
    } catch {
      return fail('studio.document-json', 'Studio export is not valid JSON.');
    }
  }
  return createStudioDocument(input as StudioDocumentInput, options);
}

export function serializeStudioDocument(document: StudioDocument, options: StudioDocumentOptions): Outcome<string> {
  const checked = createStudioDocument(document, options);
  return checked.ok ? {ok: true, value: canonical(checked.value)} : checked;
}

/** Emit a reviewable, dependency-free TypeScript module for code-owned bundles. */
export function serializeStudioCode(document: StudioDocument, options: StudioDocumentOptions): Outcome<string> {
  const serialized = serializeStudioDocument(document, options);
  return serialized.ok
    ? {ok: true, value: `/** Generated by Aeliqo Studio. Review before activation. */\nexport const studioDocument = ${serialized.value} as const;\n`}
    : serialized;
}

export function activeStudioProfile(document: StudioDocument): StudioProfile {
  return document.profiles.find((profile) => sameRef(profile.experience, document.activeProfile)) ?? document.profiles[0]!;
}

export function sourceOfMeaning(document: StudioDocument, refValue: VersionRef): MeaningSource | undefined {
  const draft = document.meanings.find((entry) => sameRef(entry.meaning, refValue));
  if (draft !== undefined) return draft.source;
  const catalogMeaning = document.catalog.meanings.find((entry) => sameRef(entry, refValue));
  return catalogMeaning === undefined ? undefined : {surface: 'code', ownership: 'code', readOnly: true};
}

export {canonical};
