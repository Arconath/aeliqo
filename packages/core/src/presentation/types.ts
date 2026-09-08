import type {CommitPreconditions, Contract, Experience, Outcome, PresentationPlan, Result, Task, VersionRef, ReadonlyJsonValue} from '../contracts/types.js';
import type {ExperienceRestriction} from '../contracts/experience/index.js';
import type {InteractionGraph, InteractionMappingManifest, InteractionPort} from '../interaction/graph.js';

export type PresentationNode = PresentationPlan['nodes'][number];
export type PresentationValue = ReadonlyJsonValue;
export type PresentationValues = Readonly<Record<string, PresentationValue>>;
/** Unknown server measurements remain unknown; this pass never reads browser globals. */
export type PresentationEnvironment = Contract<'environment'>;

export interface ResolvedPresentationConfig {
  /** Canonical bounded values used by the registered renderer. */
  readonly values: PresentationValues;
  /** Fields actually made available by this configuration, including accessible alternatives. */
  readonly fields: readonly string[];
  /** Trusted registry code derives ports from the bound result, never the proposed wire graph. */
  readonly ports: readonly InteractionPort[];
  /** Actual operations enabled by this configuration; if omitted, every manifest operation is enabled. */
  readonly operations?: readonly VersionRef[];
}

/** Trusted ordinal assessments, never model confidence or proof of business truth.
 * Ordinal fields are integers in 0..100. Cost requires a recorded measurement ref.
 */
export interface PresentationQuality {
  readonly taskFit: number;
  readonly informationDensity: number;
  readonly interactionEffort: number;
  readonly legibilityPenalty: number;
  readonly cost?: {readonly microseconds: number; readonly measurement: VersionRef};
}

/** Parsed, owned inputs supplied to trusted local pattern callbacks. */
export interface PresentationPatternContext {
  readonly task: Task;
  readonly experience: Experience;
  readonly results: readonly Result[];
  readonly current: CommitPreconditions;
  readonly environment: PresentationEnvironment;
}
export interface PresentationPatternRequest {
  readonly id: string;
  readonly revision: string;
  readonly preconditions: CommitPreconditions;
  readonly context: PresentationPatternContext;
}
/** A tested local macro. Registry installation rejects duplicate pattern IDs,
 * including multiple revisions: Experience allowlists currently contain IDs.
 * Matching never grants permission or bypasses normal plan feasibility.
 */
export interface PresentationPatternManifest {
  readonly ref: VersionRef;
  readonly expand: (request: PresentationPatternRequest) => Outcome<PresentationPlan>;
  readonly matches: (plan: PresentationPlan, context: PresentationPatternContext) => boolean;
}

/** Trusted local registry entry. Callbacks must be pure, synchronous and bounded. */
export interface PresentationManifest {
  readonly ref: VersionRef;
  readonly configSchema: VersionRef;
  readonly roles: readonly string[];
  readonly operations: readonly VersionRef[];
  readonly result: 'required' | 'optional' | 'none';
  readonly children: {readonly min: number; readonly max: number};
  /** Exclusive containers cannot satisfy a simultaneous comparison across their children. */
  readonly visibility: 'simultaneous' | 'exclusive' | 'leaf';
  readonly extension: boolean;
  /** The validator supplies the parsed node so config-dependent child layouts can reject omitted content. */
  readonly resolveConfig: (values: PresentationValues, result: Result | undefined, node?: PresentationNode) => Outcome<ResolvedPresentationConfig>;
  /** Optional tested environment envelope and ordinal assessment. A failure is
   * infeasible; an absent assessment conveys no measured quality claim. */
  readonly assess?: (config: ResolvedPresentationConfig, result: Result | undefined, environment: PresentationEnvironment) => Outcome<PresentationQuality>;
  /** Optional deterministic candidate authoring. Explicit candidates use the same validator. */
  readonly suggestConfig?: (needs: readonly Task['needs'][number][], result: Result | undefined) => Outcome<PresentationValues>;
}

/** Trusted declaration of a renderer-implemented transition. `archive` moves a
 * removed view's state into a retained owner; it does not authorize state loss.
 * Runtime must advertise the exact mapping and apply it transactionally. */
export interface PresentationStateMappingManifest {
  readonly ref: VersionRef;
  readonly from: VersionRef;
  readonly to: VersionRef;
  readonly fromRole: string;
  readonly toRole: string;
  readonly kind: 'transfer' | 'archive';
}

export interface PresentationRegistry {
  readonly manifests: readonly PresentationManifest[];
  readonly mappings: readonly InteractionMappingManifest[];
  readonly patterns?: readonly PresentationPatternManifest[];
  readonly stateMappings?: readonly PresentationStateMappingManifest[];
}

export interface PresentationContext {
  readonly task: Task;
  readonly experience: Experience;
  readonly restrictions?: readonly ExperienceRestriction[];
  /** Application-authorized descriptors only. Reference presence grants no access. */
  readonly results: readonly Result[];
  readonly current: CommitPreconditions;
  readonly environment: PresentationEnvironment;
  readonly rendererCapabilities: readonly VersionRef[];
  /** Exact registered state mappings implemented by the committing renderer. */
  readonly stateMappingCapabilities?: readonly VersionRef[];
  /** Current presentation for fixed/adaptive mode and state transfer checks. */
  readonly incumbent?: PresentationPlan;
  /** Host blocks structural replacement while focus/draft/IME owns the active view. */
  readonly transitionBlocked?: boolean;
  readonly explicitTransition?: boolean;
}

export interface ResolvedPresentationNode {
  readonly node: PresentationNode;
  readonly manifest: VersionRef;
  readonly config: ResolvedPresentationConfig;
  readonly result: Result | undefined;
  readonly quality?: PresentationQuality;
}

export interface ValidatedPresentation {
  readonly plan: PresentationPlan;
  readonly nodes: readonly ResolvedPresentationNode[];
  readonly graph: InteractionGraph;
  readonly environment: PresentationEnvironment;
}

export interface PresentationCompositionRequest {
  readonly id: string;
  readonly revision: string;
  readonly preconditions: CommitPreconditions;
  readonly context: PresentationContext;
  readonly candidates?: readonly {readonly source: 'explicit' | 'pattern'; readonly pattern?: VersionRef; readonly plan: PresentationPlan}[];
}

export interface PresentationComposition {
  readonly status: 'composed' | 'search-exhausted' | 'conflict';
  readonly presentation?: ValidatedPresentation;
  readonly expansions: number;
  readonly rejected: readonly {readonly candidate: string; readonly diagnostics: readonly import('../contracts/types.js').Diagnostic[]}[];
}
