import * as z from 'zod/mini';
import { inspectWire } from '../contracts/ingress.js';
import { WIRE_LIMITS } from '../contracts/limits.js';
import { diagnosticSchema, idSchema, versionRefSchema } from '../contracts/schemas.js';
import { compareText, stableJson, versionRefKey } from '../contracts/stable.js';
import type { Diagnostic, Outcome } from '../contracts/types.js';
import { composePresentation } from './compose.js';
import { prepareComposition, type CompositionState } from './compose-session.js';
import { freezePresentation } from './registry.js';
import type {
  PresentationClarification,
  PresentationCompositionRequest,
  PresentationDecision,
  PresentationReason,
  PresentationRejection,
  PresentationResolverCandidate,
  PresentationResolverInput,
  PresentationTargetEvidence,
} from './types.js';

const resolverRef = { id: 'aeliqo.presentation.resolver', revision: '1' } as const;
const choiceLimit = 16;
const resolverIdSchema = z
  .string()
  .check(z.minLength(1), z.maxLength(WIRE_LIMITS.id), z.regex(/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u));
const targetSchema = z.strictObject({
  address: z.strictObject({
    runtimeId: idSchema,
    scopeInstanceId: idSchema,
    activationEpoch: z.int().check(z.minimum(0)),
    surfaceId: idSchema,
    surfaceGeneration: z.int().check(z.minimum(0)),
  }),
  state: z.enum(['active', 'stale', 'revoked']),
});
const candidateSchema = z.strictObject({
  id: resolverIdSchema,
  source: z.enum(['explicit', 'pattern']),
  pattern: z.optional(versionRefSchema),
  plan: z.unknown(),
});
const choiceSchema = z.strictObject({
  id: resolverIdSchema,
  label: z.string().check(z.minLength(1), z.maxLength(WIRE_LIMITS.label)),
});
const clarificationSchema = z.strictObject({
  kind: z.enum(['measure', 'time']),
  diagnostic: diagnosticSchema,
  choices: z.array(choiceSchema).check(z.minLength(1), z.maxLength(choiceLimit)),
});

type OwnedCandidate = PresentationResolverCandidate;

function diagnostic(code: string): Diagnostic {
  return freezePresentation({ code, message: 'Presentation unsupported.', retryable: false });
}

function unsupported(
  code: string,
  diagnostics: readonly Diagnostic[] = [],
  rejections: readonly PresentationRejection[] = [],
): PresentationDecision {
  const reasons = reasonsFor(diagnostics.length === 0 ? [diagnostic(code)] : diagnostics);
  return freezePresentation({ status: 'unsupported', diagnostic: diagnostic(code), rejections, reasons });
}

function parseWire<S extends z.ZodMiniType>(input: unknown, schema: S): z.infer<S> | undefined {
  const wire = inspectWire(input);
  if (!wire.ok) return undefined;
  const parsed = z.safeParse(schema, wire.value);
  return parsed.success ? parsed.data : undefined;
}

function parseTarget(input: unknown): PresentationTargetEvidence | undefined {
  return parseWire(input, targetSchema) as PresentationTargetEvidence | undefined;
}

function candidateKey(candidate: OwnedCandidate): string {
  return [
    candidate.id,
    candidate.source,
    candidate.pattern === undefined ? '' : versionRefKey(candidate.pattern),
    stableJson(candidate.plan),
  ].join('\u0000');
}

function parseCandidates(input: unknown): readonly OwnedCandidate[] | undefined {
  const wire = inspectWire(input);
  if (!wire.ok || !Array.isArray(wire.value) || wire.value.length > 64) return undefined;
  const candidates: OwnedCandidate[] = [];
  const ids = new Set<string>();
  for (const item of wire.value) {
    const parsed = z.safeParse(candidateSchema, item);
    if (!parsed.success) return undefined;
    const candidate = parsed.data as OwnedCandidate;
    if (ids.has(candidate.id)) return undefined;
    ids.add(candidate.id);
    candidates.push(candidate);
  }
  return candidates.sort((left, right) => compareText(candidateKey(left), candidateKey(right)));
}

function parseClarification(input: unknown): PresentationClarification | undefined {
  if (input === undefined) return undefined;
  const clarification = parseWire(input, clarificationSchema) as PresentationClarification | undefined;
  if (clarification === undefined) return undefined;
  const ids = new Set<string>();
  if (clarification.choices.some((choice) => ids.has(choice.id) || (ids.add(choice.id), false))) return undefined;
  const choices = clarification.choices
    .map((choice) => ({ id: choice.id, label: choice.id }))
    .sort((left, right) => compareText(left.id, right.id));
  return freezePresentation({
    kind: clarification.kind,
    diagnostic: {
      code: clarification.diagnostic.code,
      message: 'Semantic input is required.',
      retryable: clarification.diagnostic.retryable,
    },
    choices,
  });
}

function authorizedClarification(
  clarification: PresentationClarification,
  prepared: CompositionState,
): PresentationClarification | undefined {
  const kind = clarification.kind;
  const expectedCode = `presentation.ambiguous-${kind}`;
  const recipeCode = `web.recipe.needs-input.${kind}`;
  if (clarification.diagnostic.code !== expectedCode && clarification.diagnostic.code !== recipeCode) return undefined;
  const allowed = new Set(
    prepared.prepared.results.flatMap((result) =>
      result.fields
        .filter((field) =>
          kind === 'time'
            ? field.type.value === 'date' || field.type.value === 'instant'
            : field.role === 'measure' && ['integer', 'float', 'decimal'].includes(field.type.value),
        )
        .map((field) => field.id),
    ),
  );
  if (clarification.choices.some((choice) => !allowed.has(choice.id))) return undefined;
  return clarification;
}

function clarificationDecision(
  clarification: PresentationClarification | undefined,
  prepared: CompositionState,
): PresentationDecision | undefined {
  if (clarification === undefined) return undefined;
  const authorized = authorizedClarification(clarification, prepared);
  if (authorized === undefined) return unsupported('presentation.clarification');
  return freezePresentation({
    status: 'needs-input',
    diagnostic: authorized.diagnostic,
    choices: authorized.choices,
    reasons: reasonsFor([authorized.diagnostic]),
  });
}

function reasonsFor(diagnostics: readonly Diagnostic[], candidate?: string): readonly PresentationReason[] {
  const codes = [...new Set(diagnostics.map((item) => item.code))].sort(compareText);
  return freezePresentation(codes.map((code) => ({ code, ...(candidate === undefined ? {} : { candidate }) })));
}

function rejectionsFor(
  rejected: readonly { readonly candidate: string; readonly diagnostics: readonly Diagnostic[] }[],
): readonly PresentationRejection[] {
  return freezePresentation(
    rejected
      .map(({ candidate, diagnostics }) => ({
        candidate,
        codes: [...new Set(diagnostics.map((item) => item.code))].sort(compareText),
        refs: [],
      }))
      .sort((left, right) => compareText(left.candidate, right.candidate)),
  );
}

function unsupportedDiagnostic(
  rejections: readonly PresentationRejection[],
  status: 'composed' | 'conflict' | 'search-exhausted',
): string {
  const rejected = rejections[0]?.codes[0];
  if (rejected !== undefined) return rejected;
  return status === 'search-exhausted' ? 'presentation.search-exhausted' : 'presentation.unsupported';
}

function candidateId(label: string | undefined, candidates: readonly OwnedCandidate[]): string {
  if (label === undefined) return 'registered';
  if (candidates.some((candidate) => candidate.id === label)) return label;
  const match = /^candidate\.(\d+)$/u.exec(label);
  if (match === null) return 'registered';
  return candidates[Number(match[1])]?.id ?? 'registered';
}

function compositionCandidate(
  candidate: OwnedCandidate,
): NonNullable<PresentationCompositionRequest['candidates']>[number] {
  return candidate.pattern === undefined
    ? { id: candidate.id, source: candidate.source, plan: candidate.plan }
    : { id: candidate.id, source: candidate.source, pattern: candidate.pattern, plan: candidate.plan };
}

function withPinReason(reasons: readonly PresentationReason[], hasPinConflict: boolean): readonly PresentationReason[] {
  if (!hasPinConflict || reasons.some((reason) => reason.code === 'presentation.pin-incompatible')) return reasons;
  return freezePresentation(
    [...reasons, { code: 'presentation.pin-incompatible' }].sort((left, right) =>
      compareText(left.code + '\u0000' + (left.candidate ?? ''), right.code + '\u0000' + (right.candidate ?? '')),
    ),
  );
}

function compositionFailure(
  outcome: Extract<Outcome<unknown>, { readonly ok: false }>,
  hasPinConflict = false,
): PresentationDecision {
  const reasons = withPinReason(reasonsFor(outcome.diagnostics), hasPinConflict);
  return freezePresentation({
    status: 'unsupported',
    diagnostic: diagnostic(outcome.diagnostics[0]!.code),
    rejections: [],
    reasons,
  });
}

type ResolverIngress =
  | {
      readonly ok: true;
      readonly candidates: readonly OwnedCandidate[];
      readonly clarification?: PresentationClarification;
      readonly request: PresentationCompositionRequest;
      readonly registry: PresentationResolverInput['registry'];
      readonly surfaceId: string;
    }
  | { readonly ok: false; readonly decision: PresentationDecision };

type ResolverFields = Pick<
  PresentationResolverInput,
  'id' | 'revision' | 'preconditions' | 'context' | 'registry' | 'target' | 'candidates' | 'clarification'
>;

function resolverFields(input: unknown): ResolverFields | undefined {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const values: Record<string, unknown> = {};
  try {
    for (const key of ['id', 'revision', 'preconditions', 'context', 'registry', 'target', 'candidates'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !('value' in descriptor)) return undefined;
      values[key] = descriptor.value;
    }
    const clarification = Object.getOwnPropertyDescriptor(input, 'clarification');
    if (clarification !== undefined) {
      if (!('value' in clarification)) return undefined;
      values.clarification = clarification.value;
    }
  } catch {
    return undefined;
  }
  return values as unknown as ResolverFields;
}

function resolverIngress(input: PresentationResolverInput): ResolverIngress {
  const fields = resolverFields(input);
  if (fields === undefined) return { ok: false, decision: unsupported('presentation.input') };
  const requestWire = inspectWire({
    id: fields.id,
    revision: fields.revision,
    preconditions: fields.preconditions,
    context: fields.context,
  });
  if (!requestWire.ok) return { ok: false, decision: unsupported('presentation.input') };
  const target = parseTarget(fields.target);
  if (target === undefined) return { ok: false, decision: unsupported('presentation.target') };
  if (target.state !== 'active') return { ok: false, decision: unsupported('presentation.target-inactive') };
  const candidates = parseCandidates(fields.candidates);
  if (candidates === undefined) return { ok: false, decision: unsupported('presentation.candidates') };
  const clarification = parseClarification(fields.clarification);
  if (fields.clarification !== undefined && clarification === undefined)
    return { ok: false, decision: unsupported('presentation.clarification') };
  const request: PresentationCompositionRequest = {
    id: fields.id,
    revision: fields.revision,
    preconditions: fields.preconditions,
    context: fields.context,
    candidates: candidates.map(compositionCandidate),
    searchRegistered: candidates.length === 0,
  };
  return {
    ok: true,
    candidates,
    request,
    registry: fields.registry,
    surfaceId: target.address.surfaceId,
    ...(clarification === undefined ? {} : { clarification }),
  };
}

/**
 * Pure facade over the shared composition and feasibility pipeline. It only
 * consumes supplied descriptors and target evidence; it never commits, looks
 * up a surface, or reads ambient environment state.
 */
export function resolvePresentation(input: PresentationResolverInput): PresentationDecision {
  const ingress = resolverIngress(input);
  if (!ingress.ok) return ingress.decision;
  const prepared = prepareComposition(ingress.request, ingress.registry);
  if (!prepared.ok)
    return compositionFailure(
      prepared,
      prepared.diagnostics.some((item) => item.code === 'experience.representation-conflict'),
    );
  if (prepared.value.prepared.constraints.task.regionId !== ingress.surfaceId)
    return unsupported('presentation.target-mismatch');
  const clarification = clarificationDecision(ingress.clarification, prepared.value);
  if (clarification !== undefined) return clarification;

  const composition = composePresentation(ingress.request, ingress.registry);
  if (!composition.ok) return compositionFailure(composition);
  const rejections = rejectionsFor(composition.value.rejected);
  const rejectionReasons = freezePresentation(
    rejections.flatMap((rejection) => rejection.codes.map((code) => ({ code, candidate: rejection.candidate }))),
  );
  if (composition.value.status !== 'composed' || composition.value.presentation === undefined)
    return freezePresentation({
      status: 'unsupported',
      diagnostic: diagnostic(unsupportedDiagnostic(rejections, composition.value.status)),
      rejections,
      reasons: withPinReason(
        rejectionReasons,
        prepared.value.prepared.constraints.task.viewPreference?.strength === 'explicit',
      ),
    });
  const pins = prepared.value.requestPins;
  return freezePresentation({
    status: 'ready',
    plan: composition.value.presentation,
    reasons: rejectionReasons,
    receipt: {
      resolver: resolverRef,
      request: { id: prepared.value.id, revision: prepared.value.revision },
      selectedCandidate: candidateId(composition.value.selectedCandidate, ingress.candidates),
      examinedCandidates: composition.value.expansions,
      pins: {
        taskRevision: pins.taskRevision,
        catalogRevision: pins.catalogRevision,
        experienceRevision: pins.experienceRevision,
        functionRegistryDigest: pins.functionRegistryDigest,
        policyRevision: pins.policyRevision,
      },
      rules:
        prepared.value.prepared.constraints.task.viewPreference?.strength === 'explicit'
          ? ['task.viewPreference.explicit']
          : [],
    },
  });
}
