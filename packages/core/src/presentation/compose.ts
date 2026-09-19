import * as z from 'zod/mini';
import { compareText, sameVersionRef } from '../contracts/stable.js';
import { jsonSchema } from '../contracts/schemas.js';
import type { Outcome, Result, Task, VersionRef } from '../contracts/types.js';
import { freezePresentation, presentationFailure as fail, versionKey } from './registry.js';
import { callbackOutcome } from './validation/shared.js';
import { validatePreparedPresentationPlan, type PresentationValidationOptions } from './validate.js';
import type {
  PresentationComposition,
  PresentationCompositionRequest,
  PresentationManifest,
  PresentationPatternManifest,
  PresentationRegistry,
  PresentationValues,
} from './types.js';
import { normalizePlan } from './compose-parse.js';
import { buildPlan, validPattern } from './compose-ranking.js';
import { consider, prepareComposition, reject, spend } from './compose-session.js';
import type { CompositionCandidate, CompositionState } from './compose-session.js';

const suggestionSchema = z.record(z.string(), jsonSchema);

interface RegisteredChoices {
  readonly allowed: readonly PresentationManifest[];
  readonly leavesByNeed: readonly (readonly PresentationManifest[])[];
  readonly layouts: readonly PresentationManifest[];
}

function validateCandidate(
  state: CompositionState,
  input: unknown,
  label: string,
  options: PresentationValidationOptions = {},
  candidateIsIncumbent = false,
  expansionReserved = false,
  alreadyInspected = false,
): boolean {
  if (!expansionReserved && !spend(state)) return false;
  const normalized = normalizePlan(
    input,
    state.id,
    state.revision,
    state.requestPins,
    alreadyInspected,
    state.parseCache,
  );
  if (!normalized.ok) {
    reject(state, label, normalized.diagnostics);
    return false;
  }
  const checked = validatePreparedPresentationPlan(
    normalized.value,
    state.request.context,
    state.registry,
    state.prepared,
    options,
    state.nodeMemo,
    state.nodeIdentityMemo,
    state.manifests,
    state.validationCache,
    true,
  );
  if (!checked.ok) {
    reject(state, label, checked.diagnostics);
    return false;
  }
  consider(state, checked.value, candidateIsIncumbent);
  return true;
}

function validateIncumbent(state: CompositionState): void {
  const incumbent = state.request.context.incumbent;
  if (incumbent === undefined) return;
  validateCandidate(state, { ...incumbent, stateTransfer: [] }, 'incumbent', {}, true);
}

function contextHasRenderer(capabilities: readonly VersionRef[], ref: VersionRef): boolean {
  try {
    return capabilities.some((candidate) => sameVersionRef(candidate, ref));
  } catch {
    return false;
  }
}

function patternLabel(candidate: CompositionCandidate): string {
  return 'pattern.' + candidate.pattern!.id;
}

function expandPattern(state: CompositionState, pattern: PresentationPatternManifest): Outcome<unknown> {
  let expanded: unknown;
  try {
    expanded = pattern.expand({
      id: state.id,
      revision: state.revision,
      preconditions: state.requestPins,
      context: state.prepared.patternContext,
    });
  } catch {
    return fail('pattern', 'The registered pattern expander failed.');
  }
  return callbackOutcome(expanded, 'pattern', 'The registered pattern expander failed.');
}

function processPatternCandidate(
  state: CompositionState,
  candidate: CompositionCandidate,
  pattern: PresentationPatternManifest | undefined,
): void {
  if (!spend(state)) return;
  const label = patternLabel(candidate);
  if (pattern === undefined) {
    reject(state, label, [
      { code: 'presentation.pattern', message: 'The registered pattern is unavailable.', retryable: false },
    ]);
    return;
  }
  const expansion = expandPattern(state, pattern);
  if (!expansion.ok) {
    reject(state, label, expansion.diagnostics);
    return;
  }
  validateCandidate(state, expansion.value, label, { requiredPattern: pattern }, false, true, true);
}

function processCandidate(state: CompositionState, input: unknown, index: number): void {
  if (
    input === null ||
    typeof input !== 'object' ||
    ((input as { source?: unknown }).source !== 'explicit' && (input as { source?: unknown }).source !== 'pattern')
  ) {
    reject(state, 'candidate.' + index, [
      { code: 'presentation.candidate', message: 'The candidate source is invalid.', retryable: false },
    ]);
    return;
  }
  const candidate = input as CompositionCandidate;
  const pattern = validPattern(candidate, state.registry.patterns ?? [], state.prepared);
  if (!pattern.ok) {
    reject(state, 'candidate.' + index, pattern.diagnostics);
    return;
  }
  if (candidate.source === 'pattern') {
    processPatternCandidate(state, candidate, pattern.value);
    return;
  }
  validateCandidate(state, candidate.plan, 'candidate.' + index, {}, false, false, true);
}

function processExplicitCandidates(state: CompositionState): void {
  for (let index = 0; index < (state.request.candidates ?? []).length; index += 1) {
    processCandidate(state, state.request.candidates![index], index);
    if (state.budgetBlocked) break;
  }
}

function requiredNeeds(state: CompositionState): Outcome<readonly Task['needs'][number][]> {
  const required = state.prepared.constraints.taskNeeds.filter((need) => need.required);
  for (const need of required) {
    if (
      need.outputId !== undefined &&
      state.prepared.results.filter((result) => result.ref.outputId === need.outputId).length > 1
    )
      return fail('ambiguous-result', 'Select one authorized result.');
  }
  return { ok: true, value: required };
}

function suggestionFor() {
  return (
    manifest: PresentationManifest,
    needs: readonly Task['needs'][number][],
    result: Result | undefined,
  ): Outcome<PresentationValues> => {
    if (manifest.suggestConfig === undefined)
      return fail('suggestion', 'The representation has no trusted bounded suggestion.');
    let raw: unknown;
    try {
      raw = manifest.suggestConfig(needs, result);
    } catch {
      return fail('suggestion', 'The registered configuration suggestion failed.');
    }
    const outcome = callbackOutcome(raw, 'suggestion', 'The registered configuration suggestion failed.');
    if (!outcome.ok) return outcome;
    const parsed = z.safeParse(suggestionSchema, outcome.value);
    if (!parsed.success)
      return fail('suggestion', 'The registered configuration suggestion is not bounded JSON configuration.');
    return { ok: true, value: freezePresentation(parsed.data as PresentationValues) };
  };
}

function registeredChoices(state: CompositionState, required: readonly Task['needs'][number][]): RegisteredChoices {
  const constraints = state.prepared.constraints;
  const allowed = state.registry.manifests
    .filter(
      (manifest) =>
        constraints.allowedRepresentations.includes(manifest.ref.id) &&
        contextHasRenderer(state.prepared.rendererCapabilities, manifest.ref) &&
        manifest.suggestConfig !== undefined &&
        (!manifest.extension || constraints.extensionAllowlist.some((ref) => sameVersionRef(ref, manifest.ref))),
    )
    .sort((left, right) => compareText(versionKey(left.ref), versionKey(right.ref)));
  const leavesByNeed = required.map((need) =>
    allowed.filter(
      (manifest) =>
        manifest.visibility === 'leaf' &&
        manifest.children.min === 0 &&
        manifest.operations.some((operation) => sameVersionRef(operation, need.operation)) &&
        (need.outputId === undefined ? manifest.result !== 'required' : manifest.result !== 'none'),
    ),
  );
  const layouts = allowed.filter(
    (manifest) =>
      manifest.result === 'none' &&
      manifest.visibility === 'simultaneous' &&
      manifest.children.min <= required.length &&
      manifest.children.max >= required.length,
  );
  return { allowed, leavesByNeed, layouts };
}

function tryBuild(
  state: CompositionState,
  layout: PresentationManifest | undefined,
  selected: readonly PresentationManifest[],
  label: string,
  suggest: ReturnType<typeof suggestionFor>,
): boolean {
  if (!spend(state)) return false;
  const built = buildPlan(state.request, state.prepared, state.registry, layout, selected, suggest);
  if (!built.ok) {
    reject(state, label, built.diagnostics);
    return false;
  }
  return validateCandidate(state, built.value, label, {}, false, true, true);
}

function searchQuerylessNeeds(
  state: CompositionState,
  choices: RegisteredChoices,
  suggest: ReturnType<typeof suggestionFor>,
): void {
  const emptyRoots = choices.allowed.filter(
    (manifest) => manifest.result !== 'required' && manifest.children.min === 0,
  );
  for (const root of emptyRoots) {
    tryBuild(state, root, [], 'registered.queryless.' + root.ref.id, suggest);
    if (state.budgetBlocked) break;
  }
  if (emptyRoots.length === 0)
    reject(state, 'registered-queryless', [
      {
        code: 'presentation.no-suggestion',
        message: 'No queryless root suggestion is registered.',
        retryable: false,
      },
    ]);
}

function searchSingleNeed(
  state: CompositionState,
  choices: RegisteredChoices,
  suggest: ReturnType<typeof suggestionFor>,
): void {
  for (const leaf of choices.leavesByNeed[0]!) {
    tryBuild(state, undefined, [leaf], 'registered.leaf.' + leaf.ref.id, suggest);
    if (state.budgetBlocked) break;
  }
}

function searchMultipleNeeds(
  state: CompositionState,
  choices: RegisteredChoices,
  suggest: ReturnType<typeof suggestionFor>,
): void {
  const indices = choices.leavesByNeed.map(() => 0);
  let layoutIndex = 0;
  let candidateIndex = 0;
  while (layoutIndex < choices.layouts.length) {
    const selected = choices.leavesByNeed.map((list, index) => list[indices[index]!]!);
    tryBuild(state, choices.layouts[layoutIndex]!, selected, 'registered.' + candidateIndex, suggest);
    candidateIndex += 1;
    if (state.budgetBlocked) break;
    let position = indices.length - 1;
    while (position >= 0 && indices[position]! + 1 >= choices.leavesByNeed[position]!.length) {
      indices[position] = 0;
      position -= 1;
    }
    if (position >= 0) indices[position] = indices[position]! + 1;
    else layoutIndex += 1;
  }
}

function rejectMissingRegisteredComposition(state: CompositionState): void {
  reject(state, 'registered-composition', [
    {
      code: 'presentation.no-suggestion',
      message: 'No complete registered suggestion is available.',
      retryable: false,
    },
  ]);
}

function searchRegisteredChoices(
  state: CompositionState,
  required: readonly Task['needs'][number][],
  choices: RegisteredChoices,
  suggest: ReturnType<typeof suggestionFor>,
): void {
  if (state.budgetBlocked) return;
  if (required.length === 0) searchQuerylessNeeds(state, choices, suggest);
  else if (required.length === 1 && choices.leavesByNeed[0]!.length > 0) searchSingleNeed(state, choices, suggest);
  else if (required.length > 1 && choices.layouts.length > 0 && choices.leavesByNeed.every((list) => list.length > 0))
    searchMultipleNeeds(state, choices, suggest);
  else rejectMissingRegisteredComposition(state);
}

function searchRegistered(state: CompositionState, required: readonly Task['needs'][number][]): void {
  const choices = registeredChoices(state, required);
  const suggest = suggestionFor();
  searchRegisteredChoices(state, required, choices, suggest);
}

function finishAtExpansionLimit(state: CompositionState): Outcome<PresentationComposition> {
  const presentation = state.best?.presentation;
  return {
    ok: true,
    value: freezePresentation({
      status: 'search-exhausted',
      ...(presentation === undefined ? {} : { presentation }),
      expansions: state.expansions,
      rejected: state.rejected,
    }),
  };
}

function finishComposition(state: CompositionState): Outcome<PresentationComposition> {
  const presentation = state.best?.presentation;
  let status: PresentationComposition['status'] = presentation === undefined ? 'conflict' : 'composed';
  if (state.budgetBlocked) status = 'search-exhausted';
  return {
    ok: true,
    value: freezePresentation({
      status,
      ...(presentation === undefined ? {} : { presentation }),
      expansions: state.expansions,
      rejected: state.rejected,
    }),
  };
}

/** Bounded deterministic composition. Every candidate passes the shared feasibility validator. */
export function composePresentation(
  request: PresentationCompositionRequest,
  registry: PresentationRegistry,
): Outcome<PresentationComposition> {
  const prepared = prepareComposition(request, registry);
  if (!prepared.ok) return prepared;
  const state = prepared.value;
  validateIncumbent(state);
  processExplicitCandidates(state);
  const required = requiredNeeds(state);
  if (!required.ok) return required;
  if (request.searchRegistered === false) return finishComposition(state);
  if (state.expansions >= state.prepared.constraints.maxExpansions) return finishAtExpansionLimit(state);
  searchRegistered(state, required.value);
  return finishComposition(state);
}
