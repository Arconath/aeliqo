import type * as z from 'zod';
import type {Catalog, Diagnostic, Intent, MeaningDefinition, Outcome, Scalar, SemanticType, Task, VersionRef} from '../contracts/types.js';

export const STANDARD_INTENTS = ['browse', 'detail', 'create', 'edit', 'compare', 'analyze'] as const;
export type StandardIntentKind = (typeof STANDARD_INTENTS)[number];

export interface ResourceFieldMetadata {
  readonly label?: string;
  readonly description?: string;
  readonly role?: Catalog['entities'][number]['fields'][number]['role'];
  readonly type?: SemanticType;
  /** Closed domain values exposed to bounded intent authors and validated before query execution. */
  readonly values?: readonly (string | number | boolean)[];
  readonly hidden?: boolean;
}

export interface ResourceFormBinding {
  readonly schema: VersionRef;
  readonly action: VersionRef;
}

export interface ResourcePresentationDefaults {
  readonly allowedViews: readonly string[];
  readonly preferred?: Partial<Readonly<Record<StandardIntentKind, string>>>;
}

interface ResourceInputBase<Schema extends z.ZodObject> {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly schema: Schema;
  readonly fields?: Readonly<Record<string, ResourceFieldMetadata>>;
  readonly intents?: readonly StandardIntentKind[];
  readonly presentation: ResourcePresentationDefaults;
  readonly forms?: {readonly create?: ResourceFormBinding; readonly edit?: ResourceFormBinding};
}

export interface GeneratedResourceInput<Schema extends z.ZodObject> extends ResourceInputBase<Schema> {
  readonly revision: string;
  readonly identity: readonly [string, ...string[]];
  readonly rowGrain?: readonly [string, ...string[]];
  readonly functionRegistryDigest?: string;
  /** Reviewed business meanings available to analyze intents. */
  readonly meanings?: readonly MeaningDefinition[];
  readonly catalog?: never;
  readonly entity?: never;
}

export interface CatalogResourceInput<Schema extends z.ZodObject> extends ResourceInputBase<Schema> {
  readonly catalog: Catalog;
  readonly entity?: string;
  readonly revision?: never;
  readonly identity?: never;
  readonly rowGrain?: never;
  readonly functionRegistryDigest?: never;
  readonly meanings?: never;
}

export type ResourceInput<Schema extends z.ZodObject> = GeneratedResourceInput<Schema> | CatalogResourceInput<Schema>;

export interface ResourceDefinition<Schema extends z.ZodObject = z.ZodObject> {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly schema: Schema;
  readonly catalog: Catalog;
  readonly entity: Catalog['entities'][number];
  readonly fieldMetadata: Readonly<Record<string, ResourceFieldMetadata>>;
  readonly intents: readonly StandardIntentKind[];
  readonly presentation: ResourcePresentationDefaults;
  readonly forms?: {readonly create?: ResourceFormBinding; readonly edit?: ResourceFormBinding};
  parseRecord(input: unknown): Outcome<z.output<Schema>>;
}

export interface CompileIntentOptions {
  readonly resource: ResourceDefinition;
  readonly regionId: string;
  readonly taskRevision?: string;
  readonly customIntents?: IntentCompilerRegistry;
}

export interface IntentCompilerContext {
  readonly resource: ResourceDefinition;
  readonly regionId: string;
  readonly taskRevision: string;
}

export interface CustomIntentDefinition<Input = unknown> {
  readonly ref: VersionRef;
  readonly schema: z.ZodType<Input>;
  readonly capabilities: readonly string[];
  compile(input: Input, context: IntentCompilerContext): Outcome<Task>;
}

export interface IntentCompilerRegistry {
  readonly definitions: readonly CustomIntentDefinition[];
  resolve(ref: VersionRef): CustomIntentDefinition | undefined;
}

export type ParsedIntent = Intent;
export type IntentIdentity = Readonly<Record<string, Scalar>>;

export class ResourceDefinitionError extends Error {
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];

  constructor(diagnostics: readonly [Diagnostic, ...Diagnostic[]]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join(' '));
    this.name = 'ResourceDefinitionError';
    this.diagnostics = diagnostics;
  }
}
