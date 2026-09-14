import * as z from 'zod/mini';
import {idSchema, versionRefSchema} from '../schemas.js';
import {parseExperience} from '../parse.js';
import {inspectWire} from '../ingress.js';
import {WIRE_LIMITS} from '../limits.js';
import type {Diagnostic, Experience, Outcome, Task, VersionRef, Wire} from '../types.js';
import {validateTaskStructure} from '../task/index.js';

const ids = z.array(idSchema).check(z.maxLength(WIRE_LIMITS.array));
const refs = z.array(versionRefSchema).check(z.maxLength(WIRE_LIMITS.array));
const positive = z.int().check(z.minimum(1));
/** Host-supplied restrictions intersect; labels do not establish authority or grants. */
const restrictionSchema = z.strictObject({
  id: idSchema,
  allowedRepresentations: z.optional(ids), allowedPatterns: z.optional(ids),
  allowedOperations: z.optional(refs), extensionAllowlist: z.optional(refs),
  mode: z.optional(z.enum(['fixed', 'adaptive', 'composable'])),
  agentAllowed: z.optional(z.boolean()), allowWithoutPreset: z.optional(z.boolean()),
  maxNodes: z.optional(positive), maxExpansions: z.optional(positive),
  transitionPolicy: z.optional(z.enum(['stable', 'explicit-only'])),
});
const restrictionsSchema = z.array(restrictionSchema).check(z.maxLength(16));
export type ExperienceRestriction = Wire<z.infer<typeof restrictionSchema>>;
export type ExperienceConstraints = {
  readonly experience: Experience;
  readonly task: Task;
  readonly mode: Experience['mode'];
  readonly agentAllowed: boolean;
  readonly allowedRepresentations: readonly string[];
  readonly allowedPatterns: readonly string[];
  readonly extensionAllowlist: readonly VersionRef[];
  /** Undefined means this pass supplies no operation allowlist, never a grant. */
  readonly allowedOperations: readonly VersionRef[] | undefined;
  readonly requiredOperationIds: readonly string[];
  readonly taskNeeds: Task['needs'];
  readonly unavailableOptionalNeeds: readonly string[];
  readonly allowWithoutPreset: boolean;
  readonly maxNodes: number;
  readonly maxExpansions: number;
  readonly representationReplacementAllowed: boolean;
  readonly compositionChangeAllowed: boolean;
  readonly transitionPolicy: Experience['transitionPolicy'];
  readonly preferredRepresentation: string | undefined;
  readonly appliedRestrictions: readonly string[];
};
/** Chapter06 initial search ceiling. Exhaustion is not a proof of impossibility. */
export const PRESENTATION_EXPANSION_LIMIT = 64;
const refKey = (ref: VersionRef) => JSON.stringify([ref.id, ref.revision]);
const modes = ['fixed', 'adaptive', 'composable'] as const;
function intersect<T>(current: readonly T[], limit: readonly T[], key: (value: T) => string): T[] {
  const permitted = new Set(limit.map(key));
  return current.filter(value => permitted.has(key(value)));
}
function distinctRefs(values: readonly VersionRef[]): VersionRef[] {
  return [...new Map(values.map(value => [refKey(value), value])).entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
}

/**
 * Intersect hard restrictions without scoring preferences or removing required operations.
 * This does not prove renderer capability, accessible layout, authorized effects or transition safety.
 * The caller supplies authenticated policy independently and validates the eventual candidate.
 */
export function resolveExperienceConstraints(
  experienceInput: unknown,
  taskInput: unknown,
  restrictionInput: readonly ExperienceRestriction[] = [],
): Outcome<ExperienceConstraints> {
  const parsed = parseExperience(experienceInput);
  if (!parsed.ok) return parsed;
  const taskResult = validateTaskStructure(taskInput);
  if (!taskResult.ok) return taskResult;
  const inspected = inspectWire(restrictionInput);
  if (!inspected.ok) return inspected;
  const restrictions = z.safeParse(restrictionsSchema, inspected.value);
  if (!restrictions.success) return {ok: false, diagnostics: [{code: 'experience.restriction-shape',
    message: 'Restrictions must use the declared bounded fields and values.', path: ['restrictions'], retryable: false}]};
  const experience = parsed.value;
  const task = taskResult.value.task;
  const diagnostics: Diagnostic[] = [];
  const fail = (code: string, message: string, path: readonly (string | number)[]) => {
    if (diagnostics.length < WIRE_LIMITS.diagnostics) diagnostics.push({code, message, path, retryable: false});
  };
  let representations = [...new Set(experience.allowedRepresentations)];
  let patterns = [...new Set(experience.allowedPatterns)];
  let extensions = [...experience.extensionAllowlist];
  let operations: readonly VersionRef[] | undefined;
  let mode = modes.indexOf(experience.mode);
  let agentAllowed = experience.agentAllowed;
  let allowWithoutPreset = experience.composition.allowWithoutPreset;
  let maxNodes = Math.min(experience.composition.maxNodes, WIRE_LIMITS.presentationNodes);
  let maxExpansions = Math.min(experience.composition.maxExpansions, PRESENTATION_EXPANSION_LIMIT);
  let transitionPolicy = experience.transitionPolicy;
  const applied = new Set<string>();
  restrictions.data.forEach((restriction, index) => {
    if (applied.has(restriction.id)) fail('experience.restriction-duplicate', 'Restriction IDs must be unique.', ['restrictions', index, 'id']);
    applied.add(restriction.id);
    if (restriction.allowedRepresentations !== undefined) representations = intersect(representations, restriction.allowedRepresentations, value => value);
    if (restriction.allowedPatterns !== undefined) patterns = intersect(patterns, restriction.allowedPatterns, value => value);
    if (restriction.extensionAllowlist !== undefined) extensions = intersect(extensions, restriction.extensionAllowlist, refKey);
    if (restriction.allowedOperations !== undefined) operations = operations === undefined
      ? restriction.allowedOperations : intersect(operations, restriction.allowedOperations, refKey);
    if (restriction.mode !== undefined) mode = Math.min(mode, modes.indexOf(restriction.mode));
    if (restriction.agentAllowed === false) agentAllowed = false;
    if (restriction.allowWithoutPreset === false) allowWithoutPreset = false;
    if (restriction.maxNodes !== undefined) maxNodes = Math.min(maxNodes, restriction.maxNodes);
    if (restriction.maxExpansions !== undefined) maxExpansions = Math.min(maxExpansions, restriction.maxExpansions);
    if (restriction.transitionPolicy === 'explicit-only') transitionPolicy = 'explicit-only';
  });
  if (task.viewPreference?.strength === 'explicit') representations = representations.filter(id => id === task.viewPreference!.representation);
  if (!representations.length) fail('experience.representation-conflict', 'No representation satisfies the profile and explicit restrictions.', ['allowedRepresentations']);
  const unavailableOptionalNeeds: string[] = [];
  if (operations !== undefined) {
    const permitted = new Set(operations.map(refKey));
    const permittedIds = new Set(operations.map(operation => operation.id));
    experience.requiredOperations.forEach((id, index) => {
      if (!permittedIds.has(id)) fail('experience.operation-conflict', 'A required profile operation is excluded by the restrictions.', ['requiredOperations', index]);
    });
    task.needs.forEach((need, index) => {
      if (permitted.has(refKey(need.operation))) return;
      if (need.required) fail('experience.operation-conflict', 'A required task operation or its revision is excluded by the restrictions.', ['task', 'needs', index, 'operation']);
      else unavailableOptionalNeeds.push(need.id);
    });
  }
  if (diagnostics.length) return {ok: false, diagnostics: diagnostics as [Diagnostic, ...Diagnostic[]]};
  return {ok: true, value: {experience, task, mode: modes[mode]!, agentAllowed,
    allowedRepresentations: representations.sort(), allowedPatterns: patterns.sort(),
    extensionAllowlist: distinctRefs(extensions), allowedOperations: operations === undefined ? undefined : distinctRefs(operations),
    requiredOperationIds: [...new Set(experience.requiredOperations)].sort(), taskNeeds: task.needs,
    unavailableOptionalNeeds, allowWithoutPreset, maxNodes, maxExpansions,
    representationReplacementAllowed: mode > 0, compositionChangeAllowed: mode > 1,
    transitionPolicy, preferredRepresentation: task.viewPreference?.strength === 'preferred' ? task.viewPreference.representation : undefined,
    appliedRestrictions: [...applied].sort()}};
}
