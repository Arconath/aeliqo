import type {
  Catalog,
  Contract,
  Diagnostic,
  MeaningActivationPolicy,
  MeaningActivationReceipt,
  MeaningBundle,
  MeaningDefinition,
  Outcome,
  QuerySpec,
  FunctionRegistry,
  QueryLimits,
} from '@aeliqo/sdk-core';
import type {
  AcceptedQueryWire,
  CatalogPageWire,
  CatalogRequestWire,
  CatalogTargetWire,
  DataErrorPayloadWire,
  PlanAcceptanceWire,
  PlanRequestWire,
  PlanTargetWire,
  QueryBudgetWire,
} from './schema.js';

export type ResultEvent = Contract<'result-event'>;

/** Values supported by the ADC record boundary. Nested objects are not rows. */
export type DataValue = null | boolean | number | string | {readonly decimal: string};
export type DataRecord = Readonly<Record<string, DataValue>>;

/** Wire aliases are derived from the single strict schema source in schema.ts. */
type ExactWire<T> = T extends readonly [infer Head, ...infer Tail] ? readonly [ExactWire<Head>, ...{[K in keyof Tail]: ExactWire<Tail[K]>}] : T extends readonly (infer U)[] ? readonly ExactWire<U>[] : T extends object ? {
  readonly [K in keyof T as undefined extends T[K] ? never : K]: ExactWire<Exclude<T[K], undefined>>;
} & {
  readonly [K in keyof T as undefined extends T[K] ? K : never]?: ExactWire<Exclude<T[K], undefined>>;
} : T;
export type QueryBudget = ExactWire<QueryBudgetWire> & {
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly maxMessages: number;
  readonly maxMilliseconds: number;
  readonly maxColumns: number;
};
export type CatalogTarget = ExactWire<CatalogTargetWire>;
export type PlanTarget = ExactWire<PlanTargetWire>;
export type CatalogRequest = ExactWire<CatalogRequestWire>;
export type CatalogPage = ExactWire<CatalogPageWire>;
export type PlanRequest = ExactWire<PlanRequestWire>;
export type AcceptedQuery = ExactWire<AcceptedQueryWire>;
export type PlanAcceptance = ExactWire<PlanAcceptanceWire>;
export type DataErrorPayload = ExactWire<DataErrorPayloadWire>;

export interface ReadContext {
  readonly signal?: AbortSignal;
  /** Application-owned principal. It never crosses the ADC wire envelope. */
  readonly principal?: unknown;
  /** Optional transport metadata for host policy; never used as wire authority. */
  readonly metadata?: Readonly<Record<string, string>>;
  /**
   * In-process host-owned cohort capability. HTTP transport deliberately
   * omits this field; the server supplies its own trusted resolver context.
   */
  readonly cohort?: {
    readonly principalKey: string;
    readonly resolver: import('../evaluation/types.js').CohortResolver;
    readonly resultStore: import('../results/types.js').ResultStore;
    readonly resolveResult: (ref: import('@aeliqo/sdk-core').ResultRef) => import('../results/types.js').ResultHandle | undefined;
  };
}

export type DataOperation = 'describe' | 'plan' | 'execute';

export interface ReadGrant {
  readonly scopeDigest: string;
  readonly maxBudget?: Partial<QueryBudget>;
  readonly entities?: readonly string[];
  readonly fields?: Readonly<Record<string, readonly string[]>>;
  /** Application-owned row policy. It is evaluated again at execution time. */
  readonly rowPolicy?: (input: {
    readonly entityId: string;
    readonly row: DataRecord;
    readonly query: QuerySpec;
    readonly context: ReadContext;
  }) => boolean | Promise<boolean>;
  readonly policyRevision?: string;
}

export type AuthorizeRead = (input: {
  readonly operation: DataOperation;
  readonly requestId: string;
  readonly target: CatalogTarget | PlanTarget;
  readonly query?: QuerySpec;
  readonly context: ReadContext;
}) => Promise<Outcome<ReadGrant>> | Outcome<ReadGrant>;

export interface LocalSnapshot {
  readonly catalog: Catalog;
  readonly sourceRevision: string;
  readonly records: Readonly<Record<string, readonly DataRecord[]>>;
}

export interface MeaningRegistration {
  readonly catalogRevision: string;
  readonly meanings: readonly MeaningDefinition[];
  readonly receipts: readonly MeaningActivationReceipt[];
  readonly idempotent: boolean;
}

export interface LocalDataServiceOptions {
  readonly snapshot: LocalSnapshot;
  /** Host-owned executable registry; defaults to meaningActivation.registry or the standard registry.
   * Its digest must match the catalog. */
  readonly functionRegistry?: FunctionRegistry;
  /** Host-owned planner/work ceilings, additionally bounded by sourceLimits.
   * ADC QueryBudget independently caps the streamed response. */
  readonly queryLimits?: Partial<QueryLimits>;
  /** Host-owned limits for the immutable in-process source snapshot. */
  readonly sourceLimits?: {
    readonly rows: number;
    readonly bytes: number;
  };
  readonly hostBudget?: QueryBudget;
  readonly authorize?: AuthorizeRead;
  readonly planTtlMs?: number;
  readonly maxPlans?: number;
  /** Host-owned activation policy. It is never accepted from a client request. */
  readonly meaningActivation?: {
    readonly registry: FunctionRegistry;
    readonly policy: MeaningActivationPolicy;
  };
  /**
   * Host-owned result lineage resolver used by Task evaluation. It is kept
   * outside the ADC wire protocol; HTTP services receive this port from the
   * trusted evaluator context instead.
   */
  readonly cohortResolver?: import('../evaluation/types.js').CohortResolver;
  /**
   * Host-owned handles used by the resolver for fixed cohort source results.
   * The service fills authority and catalog fields from the current plan
   * request before invoking the resolver; these handles never cross ADC.
   */
  readonly cohortContext?: (input: {
    readonly readContext: ReadContext;
    readonly principalKey: string;
    readonly scopeDigest: string;
    readonly policyRevision?: string;
    readonly catalogRevision: string;
    readonly functionRegistryDigest: string;
    readonly catalog: Catalog;
    readonly now: () => number;
  }) => Pick<import('../evaluation/types.js').CohortResolverContext, 'resultStore' | 'resolveResult'>;
}

export interface DataService {
  describe(request: CatalogRequest, context?: ReadContext): Promise<Outcome<CatalogPage>>;
  plan(request: PlanRequest, context?: ReadContext): Promise<Outcome<PlanAcceptance>>;
  execute(request: AcceptedQuery, context?: ReadContext): AsyncIterable<ResultEvent>;
}

export interface LocalDataService extends DataService {
  readonly catalog: Catalog;
  readonly sourceRevision: string;
  readonly cohortResolver?: import('../evaluation/types.js').CohortResolver;
  replaceSnapshot(snapshot: LocalSnapshot): Outcome<void>;
  registerMeaningBundle(bundle: MeaningBundle): Outcome<MeaningRegistration>;
}

export interface HttpDataServiceOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?: Readonly<Record<string, string>>;
  readonly paths?: Partial<HttpDataPaths>;
  /** Overall transport deadline, including response bodies. Defaults to 30 seconds. */
  readonly maxRequestMilliseconds?: number;
  readonly responseLimits?: {
    readonly bytes: number;
    readonly messageBytes: number;
    readonly messages: number;
    readonly rows: number;
  };
}

export interface HttpDataPaths {
  readonly describe: string;
  readonly plan: string;
  readonly execute: string;
}

export interface DataHttpServerOptions {
  readonly service: DataService;
  readonly paths?: Partial<HttpDataPaths>;
  readonly authenticate?: (request: Request) => Promise<Outcome<{readonly principal?: unknown}>> | Outcome<{readonly principal?: unknown}>;
  readonly allowedOrigin?: string;
  readonly maxRequestBytes?: number;
  readonly maxRequestMilliseconds?: number;
  /** Counts open streamed responses as well as pending authentication/reads. */
  readonly maxConcurrentRequests?: number;
}

export type DataHttpHandler = (request: Request) => Promise<Response>;

export interface UnsupportedCapability {
  readonly kind: 'operator' | 'aggregation' | 'grouping' | 'relation' | 'pagination' | 'source';
  readonly id: string;
  readonly reason: string;
  readonly alternatives: readonly string[];
}

export interface CapabilityGap extends UnsupportedCapability {
  readonly diagnostic: Diagnostic;
}

export type {Catalog, Diagnostic, MeaningBundle, MeaningDefinition, Outcome, QuerySpec};
