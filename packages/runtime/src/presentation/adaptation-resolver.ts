import type {
  PresentationComposition,
  PresentationResolverCandidate,
  PresentationTargetEvidence,
  ValidatedPresentation,
} from '@aeliqo/core/presentation';
import type { RegionSnapshot } from '../regions/types.js';
import type { PresentationAdaptationContext } from './adaptation-types.js';

export function resolverTarget(
  before: RegionSnapshot,
  supplied: PresentationTargetEvidence | undefined,
): PresentationTargetEvidence {
  return (
    supplied ?? {
      address: {
        runtimeId: 'runtime-adaptation',
        scopeInstanceId: before.id,
        activationEpoch: 0,
        surfaceId: before.id,
        surfaceGeneration: 0,
      },
      state: 'active',
    }
  );
}

export function resolverCandidates(
  candidates: PresentationAdaptationContext['candidates'],
): readonly PresentationResolverCandidate[] {
  return (candidates ?? []).map((candidate) => ({
    id: candidate.plan.id,
    source: candidate.source,
    ...(candidate.pattern === undefined ? {} : { pattern: candidate.pattern }),
    plan: candidate.plan,
  }));
}

export function compositionForDecision(
  plan: ValidatedPresentation,
  examinedCandidates: number,
): PresentationComposition {
  return Object.freeze({ status: 'composed', presentation: plan, expansions: examinedCandidates, rejected: [] });
}
