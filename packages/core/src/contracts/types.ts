import type * as z from 'zod/mini';
import type {contractSchemas, diagnosticSchema, expressionSchema, fieldSchema, meaningSchema,
  querySchema, resultRefSchema, semanticTypeSchema, versionRefSchema} from './schemas.js';
/** JSON optional members may be absent; present `undefined` is not wire data. */
export type Wire<T> = T extends object ? {readonly [K in keyof T]: Wire<Exclude<T[K], undefined>>} : T;
export type ContractKind = keyof typeof contractSchemas;
export type Contract<K extends ContractKind> = Wire<z.infer<(typeof contractSchemas)[K]>>;
export type Catalog = Contract<'catalog'>;
export type Task = Contract<'task'>;
export type Result = Contract<'result'>;
export type Experience = Contract<'experience'>;
export type Diagnostic = Wire<z.infer<typeof diagnosticSchema>>;
export type Expression = Wire<z.infer<typeof expressionSchema>>;
export type FieldDefinition = Wire<z.infer<typeof fieldSchema>>;
export type MeaningDefinition = Wire<z.infer<typeof meaningSchema>>;
export type QuerySpec = Wire<z.infer<typeof querySchema>>;
export type ResultRef = Wire<z.infer<typeof resultRefSchema>>;
export type SemanticType = Wire<z.infer<typeof semanticTypeSchema>>;
export type VersionRef = Wire<z.infer<typeof versionRefSchema>>;
export type Outcome<T> = {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]]};
