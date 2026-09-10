import type {
  AgentBindingOutcome,
  AgentTaskProposal,
  CommitPreconditions,
  Diagnostic,
  FunctionRegistry,
  OperationGrant,
  Outcome,
  QueryLimits,
  QueryPlanner,
  Catalog,
  ResultRef,
  Task,
} from '@aeliqo/core';

/**
 * A host-owned decision which explains a material semantic gap.  Decisions
 * are data supplied by the application while building the authority context;
 * they are not read from, or approved by, a model proposal.
 */
export type AgentBindingDecision =
  | {
      readonly state: 'needs-choice';
      /** Whether the host decision applies to the whole goal or one diagnostic. */
      readonly scope: 'goal' | 'diagnostic';
      /** Host-owned goal identity; model task IDs are never authority keys. */
      readonly goalEpoch: string;
      readonly diagnosticCode: string;
      readonly diagnosticPath?: readonly (string | number)[];
      readonly choices: readonly {
        readonly id: string;
        readonly label: string;
        readonly consequence: string;
      }[];
    }
  | {
      readonly state: 'needs-meaning';
      /** Whether the host decision applies to the whole goal or one diagnostic. */
      readonly scope: 'goal' | 'diagnostic';
      /** Host-owned goal identity; model task IDs are never authority keys. */
      readonly goalEpoch: string;
      readonly diagnosticCode: string;
      readonly diagnosticPath?: readonly (string | number)[];
      readonly concept: string;
      readonly authoringRoutes: readonly ('ai-assisted' | 'manual')[];
    };

/** Authenticated, host-created data. None of these fields are wire proposal data. */
export interface AgentHostContext {
  readonly principalKey: string;
  readonly regionId: string;
  readonly goalEpoch: string;
  readonly current: CommitPreconditions;
  readonly catalog: Catalog;
  readonly functionRegistry: FunctionRegistry;
  readonly grants: readonly OperationGrant[];
  /** Optional host decisions for material ambiguity or an absent meaning. */
  readonly decisions?: readonly AgentBindingDecision[];
}

export interface AgentContextRequest {
  readonly requestId: string;
  readonly targetRegionId: string;
  readonly signal: AbortSignal;
}

export interface AgentHost {
  readonly readContext: (
    input: AgentContextRequest,
  ) => Outcome<AgentHostContext> | Promise<Outcome<AgentHostContext>>;
}

export interface AgentBindOptions {
  readonly signal?: AbortSignal;
  /** Goal epoch captured when the containment run started. */
  readonly goalEpoch?: string;
}

export interface AgentBinder {
  /** Parses and semantically binds a proposal without executing any effect. */
  readonly bind: (
    input: unknown,
    options?: AgentBindOptions,
  ) => Promise<Outcome<AgentBindingOutcome>>;
  /** Runtime-derived identity for loop progress accounting; never supplied by a model. */
  readonly fingerprint: (
    input: unknown,
    options?: AgentBindOptions,
  ) => Promise<Outcome<string>>;
}

export interface AgentBinderOptions {
  readonly host: AgentHost;
  readonly queryLimits?: Partial<QueryLimits>;
  readonly maxPending?: number;
}

/** Internal result kept private to the public binding outcome. */
export interface BoundTaskValidation {
  readonly proposal: AgentTaskProposal;
  readonly task: Task;
  readonly planner?: QueryPlanner;
  readonly plans: readonly {readonly outputId: string; readonly canonical: string; readonly planKey: string}[];
  readonly requiredResults: readonly ResultRef[];
}

export type AgentBindingFailureState = Extract<AgentBindingOutcome, {readonly state: 'unsupported' | 'denied' | 'invalid' | 'stale'}>['state'];

export type AgentBindingDiagnostic = Diagnostic;
