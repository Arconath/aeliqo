import {resolveExperienceConstraints} from '../contracts/experience/index.js';
import * as z from 'zod/mini';
import {idSchema, revisionSchema} from '../contracts/schemas.js';
import {validateCommitReadSet} from '../contracts/commit.js';
import {parseResult} from '../contracts/parse.js';
import {inspectWire} from '../contracts/ingress.js';
import type {Diagnostic, Outcome, PresentationPlan, Result, Task} from '../contracts/types.js';
import type {PresentationComposition, PresentationCompositionRequest, PresentationManifest, PresentationRegistry, PresentationValues} from './types.js';
import {freezePresentation, presentationFailure as fail, versionKey} from './registry.js';
import {validatePresentationPlan} from './validate.js';

/**
 * Bounded no-preset composition. Try a complete incumbent first, then complete
 * explicit candidates, then one whole deterministic composition before variations.
 * A failed configuration suggestion is not proof no other configuration exists.
 */
export function composePresentation(request: PresentationCompositionRequest, registry: PresentationRegistry): Outcome<PresentationComposition> {
  const identity = z.safeParse(z.strictObject({id: idSchema, revision: revisionSchema}), {id: request.id, revision: request.revision});
  if (!identity.success) return fail('request', 'The composition identity is invalid.');
  const requestPins = validateCommitReadSet(request.preconditions, request.context.current);
  if (!requestPins.ok) return requestPins;
  const resolved = resolveExperienceConstraints(request.context.experience, request.context.task, request.context.restrictions);
  if (!resolved.ok) return resolved;
  const constraints = freezePresentation(resolved.value);
  const descriptors: Result[] = [];
  for (const input of request.context.results) {
    const parsed = parseResult(input);
    if (!parsed.ok) return parsed;
    descriptors.push(freezePresentation(parsed.value));
  }
  if (!constraints.allowWithoutPreset) return fail('pattern-required', 'This composition pass requires a profile allowing registered views without a preset.');
  if ((request.candidates?.length ?? 0) > 64) return fail('candidate-budget', 'The proposed complete candidate list exceeds the input budget.');
  const rejected: {candidate: string; diagnostics: readonly Diagnostic[]}[] = [];
  let expansions = 0;
  let incumbent: PresentationComposition['presentation'];
  const attempt = (plan: PresentationPlan, label: string): boolean => {
    if (expansions >= constraints.maxExpansions) return false;
    expansions++;
    const result = validatePresentationPlan(plan, request.context, registry);
    if (result.ok) {
      const candidatePins = validateCommitReadSet(result.value.plan.preconditions, requestPins.value);
      if (!candidatePins.ok) { rejected.push({candidate: label, diagnostics: candidatePins.diagnostics}); return false; }
      incumbent = freezePresentation({...result.value, plan: {...result.value.plan, id: identity.data.id, revision: identity.data.revision, preconditions: requestPins.value}});
    }
    else rejected.push({candidate: label, diagnostics: result.diagnostics});
    return result.ok;
  };
  // An incumbent is reused only after all current feasibility/read-set checks.
  if (request.context.incumbent !== undefined && attempt(request.context.incumbent, 'incumbent'))
    return {ok: true, value: freezePresentation({status: 'composed', presentation: incumbent!, expansions, rejected})};
  for (const candidate of request.candidates ?? []) {
    if (candidate.source === 'pattern') {
      rejected.push({candidate: candidate.plan.id, diagnostics: [{code: 'presentation.pattern-unavailable', message: 'No registered pattern expander is installed in this composition pass.', retryable: false}]});
      continue;
    }
    if (attempt(candidate.plan, candidate.plan.id)) return {ok: true, value: freezePresentation({status: 'composed', presentation: incumbent!, expansions, rejected})};
    if (expansions >= constraints.maxExpansions) return {ok: true, value: freezePresentation({status: 'search-exhausted', expansions, rejected})};
  }
  const capabilities = new Set(request.context.rendererCapabilities.map(versionKey));
  const allowed = registry.manifests.filter(m => constraints.allowedRepresentations.includes(m.ref.id)
    && capabilities.has(versionKey(m.ref)) && m.suggestConfig !== undefined
    && (!m.extension || constraints.extensionAllowlist.some(ref => versionKey(ref) === versionKey(m.ref))))
    .sort((a, b) => versionKey(a.ref) < versionKey(b.ref) ? -1 : 1);
  const required = constraints.taskNeeds.filter(n => n.required);
  const layouts = allowed.filter(m => m.result === 'none' && m.visibility === 'simultaneous'
    && m.children.min <= required.length && m.children.max >= required.length);
  for (const need of required) {
    if (need.outputId !== undefined && descriptors.filter(r => r.ref.outputId === need.outputId).length > 1)
      return fail('ambiguous-result', 'Several result revisions match a named output; select an exact authorized descriptor before composing.');
  }
  const resultFor = (need: Task['needs'][number]): Result | undefined => descriptors.find(r => r.ref.outputId === need.outputId);
  const choices = required.map(need => allowed.filter(m => m.visibility === 'leaf' && m.children.min === 0
    && m.operations.some(op => versionKey(op) === versionKey(need.operation)) && (need.outputId === undefined ? m.result !== 'required' : m.result !== 'none')));
  if (layouts.length === 0 || choices.some(list => list.length === 0))
    return {ok: true, value: freezePresentation({status: 'search-exhausted', expansions, rejected: [...rejected, {candidate: 'registered-composition', diagnostics: [{code: 'presentation.no-suggestion', message: 'No complete suggestion is available from the installed registry. Explicit registered configurations may still be feasible.', retryable: false}]}]})};
  const suggest = (m: PresentationManifest, needs: readonly Task['needs'][number][], result: Result | undefined): Outcome<PresentationValues> => {
    try {
      const output = m.suggestConfig!(needs, result);
      const wire = inspectWire(output);
      if (!wire.ok) return wire;
      const outcome = wire.value as {ok?: unknown; value?: unknown};
      if (outcome === null || typeof outcome !== 'object' || outcome.ok !== true || outcome.value === null || typeof outcome.value !== 'object' || Array.isArray(outcome.value))
        return fail('suggestion', 'The registered configuration suggestion failed.');
      return {ok: true, value: outcome.value as PresentationValues};
    } catch { return fail('suggestion', 'The registered configuration suggestion failed.'); }
  };
  const build = (layout: PresentationManifest, selected: readonly PresentationManifest[]): Outcome<PresentationPlan> => {
    const layoutValues = suggest(layout, [], undefined);
    if (!layoutValues.ok) return layoutValues;
    const nodes: PresentationPlan['nodes'][number][] = [];
    for (let i = 0; i < required.length; i++) {
      const need = required[i]!; const m = selected[i]!; const result = resultFor(need);
      const values = suggest(m, [need], result);
      if (!values.ok) return values;
      nodes.push({id: `view.${need.id}`, role: m.roles[0]!, representation: m.ref, ...(result === undefined ? {} : {result: result.ref}),
        config: {schema: m.configSchema, values: values.value}, children: []});
    }
    const rootNode: PresentationPlan['nodes'][number] = {id: 'layout', role: layout.roles[0]!, representation: layout.ref, config: {schema: layout.configSchema, values: layoutValues.value}, children: nodes.map(n => n.id)};
    return {ok: true, value: {id: request.id, revision: request.revision, rootId: 'layout', preconditions: request.preconditions,
      nodes: [rootNode, ...nodes],
      links: [], coverage: required.map(need => ({needId: need.id, nodeIds: [`view.${need.id}`], operations: [need.operation]})), stateTransfer: [], diagnostics: []}};
  };
  const selected = choices.map(list => list[0]!);
  const proposals: {layout: PresentationManifest; selected: readonly PresentationManifest[]}[] = [{layout: layouts[0]!, selected}];
  // Bounded single substitutions avoid enumerating the Cartesian product.
  for (let i = 0; i < choices.length && proposals.length < constraints.maxExpansions; i++) {
    for (const alternate of choices[i]!.slice(1)) {
      if (proposals.length >= constraints.maxExpansions) break;
      proposals.push({layout: layouts[0]!, selected: selected.map((m, index) => index === i ? alternate : m)});
    }
  }
  for (const layout of layouts.slice(1)) {
    if (proposals.length >= constraints.maxExpansions) break;
    proposals.push({layout, selected});
  }
  for (const [i, proposal] of proposals.entries()) {
    if (expansions >= constraints.maxExpansions) break;
    const plan = build(proposal.layout, proposal.selected);
    if (!plan.ok) { expansions++; rejected.push({candidate: `registered.${i}`, diagnostics: plan.diagnostics}); continue; }
    if (attempt(plan.value, `registered.${i}`)) return {ok: true, value: freezePresentation({status: 'composed', presentation: incumbent!, expansions, rejected})};
  }
  return {ok: true, value: freezePresentation({status: 'search-exhausted', expansions, rejected})};
}
