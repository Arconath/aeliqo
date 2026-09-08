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
  readonly resolveConfig: (values: PresentationValues, result: Result | undefined) => Outcome<ResolvedPresentationConfig>;
  /** Optional deterministic candidate authoring. Explicit candidates use the same validator. */
  readonly suggestConfig?: (needs: readonly Task['needs'][number][], result: Result | undefined) => Outcome<PresentationValues>;
}

export interface PresentationRegistry {
  readonly manifests: readonly PresentationManifest[];
  readonly mappings: readonly InteractionMappingManifest[];
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
