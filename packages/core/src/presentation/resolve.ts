import * as z from 'zod/mini';
import { inspectWire } from '../contracts/ingress.js';
import { WIRE_LIMITS } from '../contracts/limits.js';
import { diagnosticSchema, idSchema, versionRefSchema } from '../contracts/schemas.js';
import { compareText, stableJson, versionRefKey } from '../contracts/stable.js';
import type { Diagnostic, Outcome, PresentationPlan } from '../contracts/types.js';
import { composePresentation } from './compose.js';
import { prepareComposition } from './compose-session.js';
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
  id: idSchema,
  source: z.enum(['explicit', 'pattern']),
  pattern: z.optional(versionRefSchema),
  plan: z.unknown(),
});
const choiceSchema = z.strictObject({
  id: idSchema,
  label: z.string().check(z.minLength(1), z.maxLength(WIRE_LIMITS.label)),
});
const clarificationSchema = z.strictObject({
  kind: idSchema,
  diagnostic: diagnosticSchema,
  choices: z.array(choiceSchema).check(z.minLength(1), z.maxLength(choiceLimit)),
});

type OwnedCandidate = PresentationResolverCandidate;

function diagnostic(code: string): Diagnostic {
  return freezePresentation({ code, message: 'Presentation resolution is unsupported.', retryable: false });
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
      message: 'Additional semantic input is required.',
      retryable: clarification.diagnostic.retryable,
    },
    choices,
  });
}

function reasonsFor(diagnostics: readonly Diagnostic[], candidate?: string): readonly PresentationReason[] {
  const codes = [...new Set(diagnostics.map((item) => item.code))].sort(compareText);
  return freezePresentation(codes.map((code) => ({ code, ...(candidate === undefined ? {} : { candidate }) })));
}

function rejectionsFor(
  rejected: readonly { readonly candidate: string; readonly diagnostics: readonly Diagnostic[] }[],
  candidates: readonly OwnedCandidate[],
): readonly PresentationRejection[] {
  const candidateAt = (label: string): string => {
    const match = /^candidate\.(\d+)$/u.exec(label);
    if (match === null) return label;
    return candidates[Number(match[1])]?.id ?? 'invalid-candidate';
  };
  return freezePresentation(
    rejected
      .map(({ candidate, diagnostics }) => ({
        candidate: candidateAt(candidate),
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

function selectedCandidate(
  plan: PresentationPlan,
  candidates: readonly OwnedCandidate[],
  id: string,
  revision: string,
  preconditions: PresentationResolverInput['preconditions'],
): string {
  const key = stableJson(plan);
  const match = candidates.find((candidate) => stableJson({ ...candidate.plan, id, revision, preconditions }) === key);
  return match?.id ?? 'registered';
}

function compositionCandidate(
  candidate: OwnedCandidate,
): NonNullable<PresentationCompositionRequest['candidates']>[number] {
  return candidate.pattern === undefined
    ? { source: candidate.source, plan: candidate.plan }
    : { source: candidate.source, pattern: candidate.pattern, plan: candidate.plan };
}

function explicitPin(context: PresentationResolverInput['context']): boolean {
  try {
    return context.task.viewPreference?.strength === 'explicit';
  } catch {
    return false;
  }
}

function withPinReason(
  reasons: readonly PresentationReason[],
  context: PresentationResolverInput['context'],
): readonly PresentationReason[] {
  if (!explicitPin(context) || reasons.some((reason) => reason.code === 'presentation.pin-incompatible'))
    return reasons;
  return freezePresentation(
    [...reasons, { code: 'presentation.pin-incompatible' }].sort((left, right) =>
      compareText(left.code + '\u0000' + (left.candidate ?? ''), right.code + '\u0000' + (right.candidate ?? '')),
    ),
  );
}

function compositionFailure(
  outcome: Extract<Outcome<unknown>, { readonly ok: false }>,
  context: PresentationResolverInput['context'],
): PresentationDecision {
  const reasons = withPinReason(reasonsFor(outcome.diagnostics), context);
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
    }
  | { readonly ok: false; readonly decision: PresentationDecision };

function resolverIngress(input: PresentationResolverInput): ResolverIngress {
  const target = parseTarget(input?.target);
  if (target === undefined) return { ok: false, decision: unsupported('presentation.target') };
  if (target.state !== 'active') return { ok: false, decision: unsupported('presentation.target-inactive') };
  const candidates = parseCandidates(input?.candidates);
  if (candidates === undefined) return { ok: false, decision: unsupported('presentation.candidates') };
  const clarification = parseClarification(input.clarification);
  if (input.clarification !== undefined && clarification === undefined)
    return { ok: false, decision: unsupported('presentation.clarification') };
  const request: PresentationCompositionRequest = {
    id: input.id,
    revision: input.revision,
    preconditions: input.preconditions,
    context: input.context,
    candidates: candidates.map(compositionCandidate),
    searchRegistered: candidates.length === 0,
  };
  return { ok: true, candidates, request, ...(clarification === undefined ? {} : { clarification }) };
}

/**
 * Pure facade over the shared composition and feasibility pipeline. It only
 * consumes supplied descriptors and target evidence; it never commits, looks
 * up a surface, or reads ambient environment state.
 */
export function resolvePresentation(input: PresentationResolverInput): PresentationDecision {
  const ingress = resolverIngress(input);
  if (!ingress.ok) return ingress.decision;
  const prepared = prepareComposition(ingress.request, input.registry);
  if (!prepared.ok) return compositionFailure(prepared, input.context);
  if (ingress.clarification !== undefined)
    return freezePresentation({
      status: 'needs-input',
      diagnostic: ingress.clarification.diagnostic,
      choices: ingress.clarification.choices,
      reasons: reasonsFor([ingress.clarification.diagnostic]),
    });

  const composition = composePresentation(ingress.request, input.registry);
  if (!composition.ok) return compositionFailure(composition, input.context);
  const rejections = rejectionsFor(composition.value.rejected, ingress.candidates);
  const rejectionReasons = freezePresentation(
    rejections.flatMap((rejection) => rejection.codes.map((code) => ({ code, candidate: rejection.candidate }))),
  );
  if (composition.value.status !== 'composed' || composition.value.presentation === undefined)
    return freezePresentation({
      status: 'unsupported',
      diagnostic: diagnostic(unsupportedDiagnostic(rejections, composition.value.status)),
      rejections,
      reasons: withPinReason(rejectionReasons, input.context),
    });
  const pins = prepared.value.requestPins;
  return freezePresentation({
    status: 'ready',
    plan: composition.value.presentation,
    reasons: rejectionReasons,
    receipt: {
      resolver: resolverRef,
      request: { id: prepared.value.id, revision: prepared.value.revision },
      selectedCandidate: selectedCandidate(
        composition.value.presentation.plan,
        ingress.candidates,
        prepared.value.id,
        prepared.value.revision,
        pins,
      ),
      examinedCandidates: composition.value.expansions,
      pins: {
        taskRevision: pins.taskRevision,
        catalogRevision: pins.catalogRevision,
        experienceRevision: pins.experienceRevision,
        functionRegistryDigest: pins.functionRegistryDigest,
        policyRevision: pins.policyRevision,
      },
      rules: explicitPin(input.context) ? ['task.viewPreference.explicit'] : [],
    },
  });
}
