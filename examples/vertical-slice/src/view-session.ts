import {composePresentation, validatePresentationPlan, type CommitPreconditions, type Experience, type Outcome, type PresentationContext, type PresentationPlan, type Task, type ValidatedPresentation} from '@aeliqo/core';
import {createRegionStore, type RegionReadSet} from '@aeliqo/runtime/regions';
import {createInteractionController, createInteractionGraph} from '@aeliqo/runtime/interaction';
import type {MaterializedTaskOutput} from '@aeliqo/runtime/evaluation';
import {AELIQO_PRESENTATION_REFS, createAeliqoPresentationRegistry, type AeliqoRegionResult, type AeliqoSemanticInteractionRequest} from '@aeliqo/web/region';
import {stableTableRowKey} from '@aeliqo/web/table';
import {catalog, functionRegistry, initialTask} from './hr.js';
import {createHrDataSession, policyRevision, principalKey, refKey, scopeDigest} from './data-session.js';

export const experience: Experience = {version: '1', id: 'hr-experience', revision: '1', mode: 'composable', agentAllowed: false,
  allowedRepresentations: Object.values(AELIQO_PRESENTATION_REFS).map(ref => ref.id), allowedPatterns: [],
  composition: {allowWithoutPreset: true, maxNodes: 12, maxExpansions: 24}, requiredOperations: [],
  tokenProfile: {id: 'tokens.default', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable'};
export const unknownEnvironment: PresentationContext['environment'] = {inlineSize: {state: 'unknown'}, blockSize: {state: 'unknown'},
  textScale: {state: 'unknown'}, pointer: 'unknown', hover: 'unknown', keyboard: 'unknown', locale: 'en-US', direction: 'ltr', reducedMotion: false, forcedColors: false};
const unwrap = <T>(result: Outcome<T>): T => {
  if (!result.ok) throw new Error(result.diagnostics.map(d => `${d.code}: ${d.message}`).join('; '));
  return result.value;
};
const pins = ({dataRevision: _dataRevision, ...value}: RegionReadSet): CommitPreconditions => value;

/** Application integration of the same evaluator, commit store, interaction controller and web registry. */
export async function createHrViewSession() {
  const data = createHrDataSession();
  let cleanupRegions: (() => void) | undefined;
  try {
  const task = initialTask();
  const evaluated = await data.evaluate(task);
  const outputs = new Map<string, MaterializedTaskOutput>(evaluated.outputs.map(output => [output.outputId, output]));
  const listeners = new Set<() => void>();
  let serial = 0;
  let presentation: ValidatedPresentation | undefined;
  const rankedRows = () => data.permitted ? outputs.get('ranking')?.handle.snapshot().batches.flatMap(batch => batch.rows) ?? [] : [];
  const rowKey = (row: AeliqoRegionResult['rows'][number]) => stableTableRowKey(row, ['employee_id']);
  const refs = () => [...outputs.values()].map(output => output.ref);
  const registry = unwrap(createAeliqoPresentationRegistry({resolveEntity: result => {
    const handle = data.resolveResult(result.ref);
    if (!data.permitted || handle?.snapshot().descriptor === undefined) return undefined;
    return result.identity.length === 1 && result.identity[0] === 'employee_id' ? 'employees' : undefined;
  }}));
  const context = (nextTask: Task, current: CommitPreconditions, incumbent?: PresentationPlan): PresentationContext => ({
    task: nextTask, experience, results: [...outputs.values()].flatMap(output => output.descriptor === undefined ? [] : [output.descriptor]), current,
    environment: unknownEnvironment, rendererCapabilities: Object.values(AELIQO_PRESENTATION_REFS), ...(incumbent === undefined ? {} : {incumbent}),
  });
  const regions = createRegionStore({
    readAuthority: () => data.permitted ? {ok: true, value: {principalKey, scopeDigest, policyRevision, catalogRevision: catalog.revision,
      experienceRevision: experience.revision, functionRegistryDigest: functionRegistry.digest, results: refs()}}
      : {ok: false, diagnostics: [{code: 'runtime.region-denied', message: 'Fixture access revoked.', retryable: false}]},
    authorizeCommit: ({state, current}) => {
      if (!data.permitted || current.readSet === undefined || state.presentation === undefined)
        return {ok: false, diagnostics: [{code: 'runtime.region-denied', message: 'No authorized presentation is available.', retryable: false}]};
      const checked = validatePresentationPlan(state.presentation, context(state.task, pins(current.readSet), current.state?.presentation), registry);
      return checked.ok ? {ok: true, value: undefined}
        : {ok: false, diagnostics: [{code: 'runtime.region-invalid', message: checked.diagnostics.map(d => d.message).join('; '), retryable: false}]};
    },
  });
  cleanupRegions = () => regions.dispose();
  const region = unwrap(regions.create({id: task.regionId, state: {task}}));
  const initialPins = pins(region.snapshot().readSet!);
  const composed = unwrap(composePresentation({id: 'hr-composition', revision: '1', preconditions: initialPins, context: context(task, initialPins)}, registry));
  if (composed.presentation === undefined) { evaluated.release(); regions.dispose(); data.dispose(); throw new Error(JSON.stringify(composed.rejected)); }
  presentation = composed.presentation;
  const token = unwrap(await region.stage({requestId: 'initial-presentation', expected: region.snapshot().readSet!,
    state: {task, presentation: presentation.plan}, resultHandles: evaluated.outputs.map(output => output.handle)}));
  unwrap(await region.commit(token));
  evaluated.release();

  const sync = () => {
    const snapshot = region.snapshot();
    if (snapshot.status !== 'active' || snapshot.state?.presentation === undefined) presentation = undefined;
    else if (presentation !== undefined) presentation = {...presentation, plan: snapshot.state.presentation};
    for (const listener of listeners) listener();
  };
  sync();
  const observer = region.observe(sync);
  const graph = createInteractionGraph(presentation!.graph);
  const interactions = createInteractionController({region, graph,
    readContext: () => ({principalKey, draftDomain: 'synthetic-hr', actor: {id: principalKey, kind: 'user'},
      grants: data.permitted ? ['result.inspect', 'experience.commit'] : [], scopeDigest, policyRevision, catalogRevision: catalog.revision,
      experienceRevision: experience.revision, functionRegistryDigest: functionRegistry.digest, results: refs()}),
    resolveResult: ref => data.resolveResult(ref),
    validateSelection: selection => {
      if (selection.mode === 'clear') return {ok: true, value: undefined};
      if (selection.mode !== 'ids' || selection.entity !== 'employees')
        return {ok: false, diagnostics: [{code: 'runtime.interaction-denied', message: 'Only the ranked employee identities can be selected.', retryable: false}]};
      const ranking = outputs.get('ranking');
      const permittedKeys = new Set(rankedRows().map(rowKey));
      return ranking !== undefined && refKey(selection.result) === refKey(ranking.ref) && selection.keys.every(key => permittedKeys.has(key))
        ? {ok: true, value: undefined}
        : {ok: false, diagnostics: [{code: 'runtime.interaction-denied', message: 'The selection is outside this ranked population.', retryable: false}]};
    },
  });

  const reorderCandidate = () => {
    const current = region.snapshot();
    if (current.state?.presentation === undefined || current.readSet === undefined) throw new Error('No current presentation.');
    const previous = current.state.presentation;
    const {outputs: _outputs, ...base} = initialTask();
    const nextTask: Task = {...base, revision: current.taskRevision, kind: 'presentation', inputs: refs(), goal: 'Reorder the existing ranking and trend views.'};
    const candidate: PresentationPlan = {...previous, revision: `view-${++serial}`, preconditions: pins(current.readSet),
      nodes: previous.nodes.map(node => node.id === previous.rootId ? {...node, children: [...node.children].reverse()} : node),
      stateTransfer: previous.nodes.map(node => ({fromNode: node.id, toNode: node.id, mapping: {id: 'aeliqo.state.identity', revision: '1'}}))};
    return {candidate, nextTask, expected: current.readSet, previous};
  };
  return {
    data, region,
    selectionKey(employeeId: string) { const row = rankedRows().find(row => row.employee_id === employeeId); return row === undefined ? undefined : rowKey(row); },
    selectionLabel(key: string) { const id = rankedRows().find(row => rowKey(row) === key)?.employee_id; return typeof id === 'string' ? id : undefined; },
    get presentation() { return presentation; },
    get results(): readonly AeliqoRegionResult[] {
      return [...outputs.values()].flatMap(output => output.handle.snapshot().descriptor === undefined ? [] : [{ref: output.ref,
        rows: output.handle.snapshot().batches.flatMap(batch => batch.rows) as AeliqoRegionResult['rows']}]);
    },
    get interaction() { return region.snapshot().state?.interaction; },
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    async dispatch(request: AeliqoSemanticInteractionRequest) {
      const eventId = `user-${++serial}`;
      return interactions.dispatch({eventId, causationId: eventId, regionId: task.regionId, regionRevision: region.snapshot().regionRevision,
        originNodeId: request.nodeId, payload: request.payload}, {sourcePortId: request.portId});
    },
    async reorder() {
      const proposal = reorderCandidate();
      const checked = unwrap(validatePresentationPlan(proposal.candidate, context(proposal.nextTask, pins(proposal.expected), proposal.previous), registry));
      const staged = unwrap(await region.stage({requestId: `reorder-${serial}`, expected: proposal.expected, state: {task: proposal.nextTask, presentation: checked.plan}}));
      unwrap(await region.commit(staged)); presentation = {...checked, plan: region.snapshot().state!.presentation!}; sync();
    },
    async refuseStaleProposal() {
      const proposal = reorderCandidate();
      unwrap(await region.publishData({results: refs(), reason: 'Fixture data epoch advanced before a delayed proposal.'}));
      const staged = await region.stage({requestId: `stale-${serial}`, expected: proposal.expected, state: {task: proposal.nextTask, presentation: proposal.candidate}});
      if (staged.ok) { region.discard(staged.value); throw new Error('A stale candidate was accepted.'); }
      return staged.diagnostics;
    },
    revoke() { interactions.revoke('Fixture access revoked.'); data.revoke(); region.revoke('Fixture access revoked.'); sync(); },
    dispose() { observer.unsubscribe(); interactions.dispose(); graph.dispose(); regions.dispose(); data.dispose(); listeners.clear(); },
  };
  } catch (error) {
    cleanupRegions?.(); data.dispose();
    throw error;
  }
}
export type HrViewSession = Awaited<ReturnType<typeof createHrViewSession>>;
