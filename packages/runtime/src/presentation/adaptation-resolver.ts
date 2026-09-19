import type {
  PresentationComposition,
  PresentationResolverCandidate,
  PresentationTargetEvidence,
  ValidatedPresentation,
} from '@aeliqo/core/presentation';
import type { RegionSnapshot } from '../regions/types.js';
import type { PresentationAdaptationContext, PresentationAdaptationTarget } from './adaptation-types.js';

function sameAddress(
  left: PresentationTargetEvidence['address'],
  right: PresentationTargetEvidence['address'],
): boolean {
  return (
    left.runtimeId === right.runtimeId &&
    left.scopeInstanceId === right.scopeInstanceId &&
    left.activationEpoch === right.activationEpoch &&
    left.surfaceId === right.surfaceId &&
    left.surfaceGeneration === right.surfaceGeneration
  );
}

export function resolverTarget(
  before: RegionSnapshot,
  target: PresentationAdaptationTarget | undefined,
): PresentationTargetEvidence {
  if (target === undefined)
    return {
      address: {
        runtimeId: 'runtime-adaptation',
        scopeInstanceId: before.id,
        activationEpoch: 0,
        surfaceId: before.id,
        surfaceGeneration: 0,
      },
      state: 'active',
    };
  let supplied: PresentationTargetEvidence;
  try {
    supplied = target.read();
  } catch {
    return { address: target.address, state: 'stale' };
  }
  if (target.address.surfaceId === before.id && sameAddress(supplied.address, target.address)) return supplied;
  return { address: target.address, state: 'stale' };
}

export function resolverCandidates(
  candidates: PresentationAdaptationContext['candidates'],
): readonly PresentationResolverCandidate[] {
  return (candidates ?? []).map((candidate, index) => ({
    id: `candidate.${String(index).padStart(2, '0')}`,
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
