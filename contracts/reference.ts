/**
 * Aeliqo 0.1.0 Master consolidation contract prototype. NOT the published SDK or a complete validator.
 * M1 must generate public types/wire schemas from one canonical definition source.
 * These values separate meaning from effects and preserve the audited edge cases.
 * No DOM, renderer, provider, database or network dependency belongs in this file.
 */
export type Id = string;
export type Revision = string;
export type NonEmpty<T> = readonly [T, ...T[]];
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export interface VersionRef { readonly id: Id; readonly revision: Revision }
export type ExactDecimal = { readonly decimal: string }; // validate canonical syntax/scale at ingress
export type Value = null | boolean | number | string | ExactDecimal;
export type PrimitiveType = 'text'|'boolean'|'integer'|'float'|'decimal'|'date'|'instant';
export interface SemanticType {
  readonly value: PrimitiveType;
  readonly nullable: boolean;
  readonly unit?: { readonly dimension: string; readonly symbol: string; readonly currency?: string };
  readonly grain?: readonly Id[];
  readonly temporal?: { readonly calendar: string; readonly timezone?: string; readonly grain?: string };
}
export interface FieldDefinition {
  readonly id: Id;
  readonly label: string;
  readonly type: SemanticType;
  readonly role: 'identity'|'attribute'|'dimension'|'measure'|'time';
  readonly derivation?: VersionRef;
}
export interface RelationshipDefinition {
  readonly id: Id;
  readonly sourceEntity: Id;
  readonly targetEntity: Id;
  readonly keys: NonEmpty<{ readonly sourceField: Id; readonly targetField: Id }>;
  readonly cardinality: 'one-to-one'|'many-to-one'|'one-to-many'|'many-to-many';
  readonly optional: boolean;
  readonly joinPolicy: 'validated'|'explicit-bridge-required'|'not-queryable';
  readonly revision: Revision;
}
export type Expression =
  | { readonly kind:'literal'; readonly value:Value; readonly type:SemanticType }
  | { readonly kind:'field'; readonly ref:Id }
  | { readonly kind:'definition'; readonly ref:VersionRef }
  | { readonly kind:'call'; readonly function:VersionRef; readonly arguments:readonly Expression[] };
export type MeaningScope = 'session'|'personal'|'workspace'|'organization';
export interface MeaningDefinition {
  readonly id: Id;
  readonly revision: Revision;
  readonly label: string;
  readonly explanation: string;
  readonly output: SemanticType;
  readonly implementation: { readonly kind:'expression'; readonly expression:Expression }
    | { readonly kind:'host-capability'; readonly capability:VersionRef };
  readonly dependencies: readonly VersionRef[];
  readonly functionRegistryDigest: string;
  readonly origin:'system'|'manual'|'ai-assisted';
  readonly lifecycle:'draft'|'active'|'deprecated';
  readonly scope:MeaningScope;
  readonly authority:'hypothesis'|'reviewed'|'approved'; // actual authority is verified host-side
  readonly aggregation:'additive'|'semi-additive'|'non-additive'|'ratio-of-sums'|'none';
  readonly aggregationDimensions:readonly Id[];
  readonly missingPolicy:'propagate'|'exclude-pair'|'reject';
  readonly goal?:'minimize'|'maximize';
}
export interface Catalog {
  readonly version:'1';
  readonly revision:Revision;
  readonly functionRegistryDigest:string;
  readonly entities:readonly {
    readonly id:Id; readonly label:string; readonly identity:NonEmpty<Id>;
    readonly rowGrain:NonEmpty<Id>; readonly fields:readonly FieldDefinition[];
  }[];
  readonly relationships:readonly RelationshipDefinition[];
  readonly meanings:readonly MeaningDefinition[];
  readonly capabilities:readonly {
    readonly ref:VersionRef; readonly entity:Id;
    readonly operators:readonly VersionRef[];
    readonly fields:readonly Id[];
    readonly relations:readonly VersionRef[];
    readonly maxOutputRows:number;
  }[];
  readonly nextCursor?:string;
}
export interface Period {
  readonly from:string; readonly toExclusive:string;
  readonly calendar:string; readonly timezone:string;
  readonly interpretation:string; // already resolved against a clock, not "three months ago"
}
export type Predicate =
  | { readonly op:'compare'; readonly field:Id; readonly entity?:Id; readonly comparison:'eq'|'ne'|'lt'|'lte'|'gt'|'gte'; readonly value:Value }
  | { readonly op:'is-null'; readonly field:Id; readonly entity?:Id; readonly negate:boolean }
  | { readonly op:'in'; readonly field:Id; readonly entity?:Id; readonly values:readonly Value[] }
  | { readonly op:'and'|'or'; readonly predicates:readonly Predicate[] }
  | { readonly op:'not'; readonly predicate:Predicate };
export interface ResultRef {
  readonly id:Id; readonly revision:Revision; readonly outputId:Id;
  readonly queryDigest:string; readonly scopeDigest:string;
}
export type Population =
  | { readonly kind:'all-authorized' }
  | { readonly kind:'fixed'; readonly source:ResultRef; readonly identityKeys:NonEmpty<Id>; readonly cohortDigest:string }
  | { readonly kind:'live-output'; readonly outputId:Id; readonly identityKeys:NonEmpty<Id> };
export interface QuerySpec {
  readonly entity:Id;
  readonly fields:readonly Id[];
  readonly measures:readonly VersionRef[];
  readonly relations:readonly VersionRef[];
  readonly relationUsage?:readonly {readonly relation:VersionRef; readonly kind:'inner'|'left'|'semi'; readonly where?:Predicate}[];
  readonly windows?:readonly {readonly id:Id; readonly function:VersionRef; readonly arguments:readonly Expression[];
    readonly partitionBy:readonly Expression[];
    readonly orderBy:readonly {readonly expression:Expression; readonly direction:'asc'|'desc'; readonly nulls:'first'|'last'}[];
    readonly frame:{readonly preceding:number; readonly following:number}}[];
  readonly groupBy:readonly Id[];
  readonly where?:Predicate;
  readonly period?:Period;
  readonly timeBucket?:{ readonly field:Id; readonly grain:string };
  readonly population:Population;
  readonly order:readonly { readonly field:Id; readonly direction:'asc'|'desc'; readonly nulls:'first'|'last' }[];
  readonly page?:{ readonly size:number; readonly cursor?:string };
}
export type TaskOutput =
  | { readonly id:Id; readonly kind:'query'; readonly query:QuerySpec;
      readonly dependsOn:readonly Id[]; readonly delivery:'eager'|'on-demand' }
  | { readonly id:Id; readonly kind:'reuse'; readonly result:ResultRef; readonly dependsOn:readonly [] };
export interface OperationNeed {
  readonly id:Id;
  readonly operation:VersionRef;
  readonly outputId?:Id;
  readonly fields:readonly Id[];
  readonly required:boolean;
  readonly simultaneousGroup?:Id;
}
export interface TaskBase {
  readonly version:'1'; readonly id:Id; readonly revision:Revision;
  readonly catalogRevision:Revision; readonly functionRegistryDigest:string;
  readonly regionId:Id; readonly goal:string; readonly needs:readonly OperationNeed[];
  readonly assumptions:readonly string[];
  readonly viewPreference?:{ readonly representation:Id; readonly strength:'explicit'|'preferred' };
}
export type Task = TaskBase & (
  | { readonly kind:'data'; readonly outputs:NonEmpty<TaskOutput> }
  | { readonly kind:'presentation'; readonly inputs:readonly ResultRef[] }
  | { readonly kind:'form'; readonly schema:VersionRef; readonly action:VersionRef; readonly entityKey?:string }
);
export type Uncertainty =
  | { readonly kind:'quantified'; readonly lower:number; readonly upper:number; readonly interpretation:string }
  | { readonly kind:'unquantified'; readonly reason:string };
export type PopulationCount =
  | { readonly kind:'unknown' }
  | { readonly kind:'exact'; readonly value:number; readonly populationDigest:string }
  | { readonly kind:'estimated'; readonly value:number; readonly populationDigest:string;
      readonly method:string; readonly uncertainty:Uncertainty };
export type Precision =
  | { readonly kind:'exact' }
  | { readonly kind:'approximate'; readonly method:string; readonly uncertainty:Uncertainty };
export type Coverage =
  | { readonly kind:'complete'; readonly populationDigest:string }
  | { readonly kind:'partial'; readonly populationDigest:string; readonly reason:string }
  | { readonly kind:'sample'; readonly populationDigest:string; readonly method:string }
  | { readonly kind:'unknown'; readonly reason:string };
export type Consistency =
  | { readonly kind:'snapshot'; readonly snapshotId:string; readonly sourceRevisions:Readonly<Record<Id,Revision>> }
  | { readonly kind:'mixed'; readonly sourceRevisions:Readonly<Record<Id,Revision>>; readonly reason:string }
  | { readonly kind:'unknown'; readonly reason:string };
export type EvidenceClass =
  | { readonly kind:'observed'; readonly source:VersionRef }
  | { readonly kind:'computed'; readonly queryDigest:string; readonly definitions:readonly VersionRef[] }
  | { readonly kind:'inferred'; readonly recipe:VersionRef; readonly method:string; readonly uncertainty:Uncertainty };
export interface ResultDescriptor {
  readonly ref:ResultRef; readonly taskId:Id;
  readonly fields:readonly FieldDefinition[];
  readonly identity:readonly Id[]; readonly rowGrain:readonly Id[];
  readonly counts:{ readonly loaded:number; readonly population:PopulationCount };
  readonly precision:Precision; readonly coverage:Coverage;
  readonly consistency:Consistency; readonly evidence:EvidenceClass;
  readonly filters:readonly Predicate[]; readonly period?:Period;
  readonly warnings:readonly Diagnostic[];
  readonly lineage:readonly { readonly output:Id; readonly inputs:readonly ResultRef[] }[];
}
export type ResultEvent =
  | { readonly kind:'descriptor'; readonly descriptor:ResultDescriptor }
  | { readonly kind:'batch'; readonly result:ResultRef; readonly sequence:number;
      readonly rows:readonly Readonly<Record<Id,Value>>[] }
  | { readonly kind:'progress'; readonly result:ResultRef; readonly completed:number; readonly total?:number; readonly unit:'rows'|'bytes'|'batches' }
  | { readonly kind:'complete'; readonly result:ResultRef; readonly finalCoverage:Coverage; readonly cursor?:string }
  | { readonly kind:'error'; readonly requestId:Id; readonly error:Diagnostic };
export interface Diagnostic {
  readonly code:string; readonly message:string;
  readonly path?:readonly (string|number)[];
  readonly remedies?:readonly string[]; readonly retryable:boolean;
}
export type Outcome<T> = { readonly ok:true; readonly value:T }
  | { readonly ok:false; readonly diagnostics:NonEmpty<Diagnostic> };
export interface DataRequestContext {
  readonly requestId:Id;
  readonly principalScopeKey:string; // injected by authenticated host, not a client authority field
  readonly policyRevision:Revision;
  readonly budget:{ readonly rows:number; readonly bytes:number; readonly milliseconds:number };
}
export interface PlanHandle {
  readonly id:Id; readonly catalogRevision:Revision; readonly functionRegistryDigest:string;
  readonly queryDigest:string; readonly expiresAt:string; readonly predictedFields:readonly FieldDefinition[];
}
export interface ApplicationDataContract {
  describe(request:{ readonly cursor?:string; readonly query?:string },context:DataRequestContext):Promise<Outcome<Catalog>>;
  plan(query:QuerySpec,context:DataRequestContext):Promise<Outcome<PlanHandle>>;
  execute(plan:PlanHandle,context:DataRequestContext):AsyncIterable<ResultEvent>;
  cancel?(requestId:Id,context:DataRequestContext):Promise<void>;
}
export type Measurement = { readonly state:'unknown' } | { readonly state:'known'; readonly value:number };
export interface Environment {
  readonly inlineSize:Measurement; readonly blockSize:Measurement;
  readonly textScale:Measurement;
  readonly pointer:'fine'|'coarse'|'mixed'|'unknown';
  readonly hover:'available'|'unavailable'|'unknown';
  readonly keyboard:'available'|'unknown'; // small viewport cannot establish absence
  readonly locale:string; readonly direction:'ltr'|'rtl';
  readonly reducedMotion:boolean; readonly forcedColors:boolean;
}
export interface Experience {
  readonly version:'1'; readonly id:Id; readonly revision:Revision;
  readonly mode:'fixed'|'adaptive'|'composable'; readonly agentAllowed:boolean;
  readonly allowedRepresentations:readonly Id[]; readonly allowedPatterns:readonly Id[];
  readonly composition:{ readonly allowWithoutPreset:boolean; readonly maxNodes:number; readonly maxExpansions:number };
  readonly requiredOperations:readonly Id[]; readonly tokenProfile:VersionRef;
  readonly extensionAllowlist:readonly VersionRef[]; readonly transitionPolicy:'stable'|'explicit-only';
}
export interface RepresentationCapability {
  readonly ref:VersionRef; readonly operations:readonly VersionRef[];
  readonly fieldRoles:readonly FieldDefinition['role'][];
  readonly configSchema:VersionRef;
  readonly ports:readonly { readonly id:Id; readonly direction:'in'|'out'; readonly payloadSchema:VersionRef }[];
  readonly realization:'native-web'|'svg'|'canvas'; readonly costClass:'small'|'medium'|'large';
}
export interface FieldEncoding { readonly field:Id; readonly scale:'ordinal'|'linear'|'log'|'temporal' }
export type PlotSpec =
  | { readonly kind:'unit'; readonly mark:'point'|'line'|'bar'|'area'|'cell'|'link'|'rect';
      readonly encoding:Readonly<Record<string,FieldEncoding>>; readonly result:ResultRef }
  | { readonly kind:'layer'; readonly children:NonEmpty<PlotSpec>; readonly scales:'shared-compatible'|'independent' }
  | { readonly kind:'facet'; readonly field:Id; readonly child:PlotSpec; readonly scales:'shared-compatible'|'independent' }
  | { readonly kind:'concat'; readonly direction:'inline'|'block'; readonly children:NonEmpty<PlotSpec> };
export interface PresentationNode {
  readonly id:Id; readonly role:Id; readonly representation:VersionRef;
  readonly result?:ResultRef;
  readonly config:{ readonly schema:VersionRef; readonly values:Readonly<Record<string,Json>> };
  readonly children:readonly Id[];
}
export interface InteractionLink {
  readonly id:Id;
  readonly source:{ readonly node:Id; readonly port:Id };
  readonly target:{ readonly node:Id; readonly port:Id };
  readonly mapping:VersionRef; readonly propagation:'directed'|'identity-equivalence';
}
export interface CommitPreconditions {
  readonly scopeDigest:string; readonly policyRevision:Revision;
  readonly taskRevision:Revision; readonly regionRevision:Revision;
  readonly catalogRevision:Revision; readonly experienceRevision:Revision;
  readonly functionRegistryDigest:string;
  readonly results:readonly ResultRef[];
}
export interface PresentationPlan {
  readonly id:Id; readonly revision:Revision; readonly rootId:Id;
  readonly preconditions:CommitPreconditions;
  readonly nodes:readonly PresentationNode[];
  readonly links:readonly InteractionLink[];
  readonly coverage:readonly { readonly needId:Id; readonly nodeIds:NonEmpty<Id>; readonly operations:NonEmpty<VersionRef> }[];
  readonly stateTransfer:readonly { readonly fromNode:Id; readonly toNode:Id; readonly mapping:VersionRef }[];
  readonly diagnostics:readonly Diagnostic[];
}
export type Selection =
  | { readonly mode:'clear' }
  | { readonly mode:'ids'; readonly entity:Id; readonly keys:NonEmpty<string>; readonly result:ResultRef }
  | { readonly mode:'predicate'; readonly entity:Id; readonly predicate:Predicate; readonly queryDigest:string; readonly populationDigest:string };
export type InteractionPayload =
  | { readonly kind:'selection'; readonly selection:Selection }
  | { readonly kind:'filter'; readonly predicates:readonly Predicate[]; readonly outputId:Id }
  | { readonly kind:'range'; readonly field:Id; readonly range:Period|null; readonly outputId:Id }
  | { readonly kind:'group'; readonly field:Id; readonly value:Value; readonly outputId:Id }
  | { readonly kind:'page'; readonly outputId:Id; readonly cursor:string; readonly queryDigest:string }
  | { readonly kind:'navigate'; readonly route:VersionRef; readonly params:Readonly<Record<string,Value>> }
  | { readonly kind:'draft'; readonly entity:Id; readonly key:string; readonly field:Id; readonly value:Value; readonly entityRevision:Revision }
  | { readonly kind:'action-request'; readonly action:VersionRef; readonly input:Readonly<Record<string,Value>> }
  | { readonly kind:'extension'; readonly schema:VersionRef; readonly value:Json };
export interface Interaction {
  readonly eventId:Id; readonly causationId:Id; readonly regionId:Id;
  readonly regionRevision:Revision; readonly originNodeId:Id;
  readonly payload:InteractionPayload;
}
export type EffectClass = 'read'|'meaning-draft'|'meaning-activate'|'present'|'business-write';
export interface Proposal<T> {
  readonly requestId:Id; readonly targetRegionId:Id;
  readonly effect:EffectClass; readonly preconditions:CommitPreconditions; readonly value:T;
  // No caller-controlled actor, principal, approvedBy, or bypassConfirmation.
}
export interface Claim {
  readonly id:Id; readonly text:string;
  readonly classification:'observation'|'computed-comparison'|'inference'|'causal-hypothesis';
  readonly evidence:NonEmpty<{ readonly result:ResultRef; readonly fields:readonly Id[]; readonly definitions:readonly VersionRef[] }>;
  readonly assumptions:readonly string[];
}
export interface ProjectionReceipt {
  readonly requestId:Id; readonly planRevision:Revision;
  readonly status:'evaluated'|'committed'|'renderer-ready'|'partial'|'cancelled'|'failed';
  readonly results:readonly ResultRef[]; readonly diagnostics:readonly Diagnostic[];
  // Ready is not proof of a browser paint, human attention, or accessibility conformance.
}
