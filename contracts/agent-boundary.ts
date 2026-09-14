/** Reference contract extension, not a production binder or provider quality guarantee. */
import type { Diagnostic, Id, MeaningDefinition, NonEmpty, Proposal, Revision, Task } from './reference.js';
export type OperationGrant =
  | 'catalog.read' | 'result.inspect' | 'task.propose' | 'task.evaluate'
  | 'experience.propose' | 'experience.commit' | 'meaning.propose' | 'meaning.activate'
  | 'action.propose' | 'action.execute' | 'model.egress';
/** Created by authenticated host integration. Never deserialize this from model JSON. */
export interface TrustedAgentContext {
  readonly principalScope: string;
  readonly policyRevision: Revision;
  readonly grants: readonly OperationGrant[];
  readonly confirmationReceipt?: Id;
}
export type MeaningDraft = Omit<MeaningDefinition, 'authority' | 'lifecycle'> & { readonly lifecycle: 'draft' };
export type TaskProposal = Proposal<Task>;
export type BindingOutcome<T> =
  | { readonly state: 'bound'; readonly value: T; readonly interpretation: string; readonly assumptions: readonly string[] }
  | { readonly state: 'needs-choice'; readonly choices: NonEmpty<{ readonly id: Id; readonly label: string; readonly consequence: string }> }
  | { readonly state: 'needs-meaning'; readonly concept: string; readonly authoringRoutes: readonly ('ai-assisted'|'manual')[] }
  | { readonly state: 'unsupported'|'denied'|'invalid'|'stale'; readonly diagnostics: NonEmpty<Diagnostic> };
export type ModelEvaluationState =
  | { readonly state: 'untested'; readonly reason: string }
  | { readonly state: 'evaluated'; readonly modelSnapshot: string; readonly recipeDigest: string;
      readonly corpusDigest: string; readonly trials: number; readonly evidenceId: Id;
      readonly scope: string; readonly permittedGrantsChanged: false };
export type AgentStopReason = 'complete'|'cancelled'|'turn-budget'|'cost-budget'|'query-budget'|'no-progress'|'denied'|'unavailable';
