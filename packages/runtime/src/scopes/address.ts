import type { ScopeResolution, ScopeSelector } from './types.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_LINEAGE = 16;

export function freezeSelector(selector: ScopeSelector): ScopeSelector {
  if (!ID_PATTERN.test(selector.kind) || !ID_PATTERN.test(selector.id))
    throw new TypeError('Scope selectors require bounded kind and id values.');
  if ((selector.lineage?.length ?? 0) > MAX_LINEAGE)
    throw new TypeError(`Scope selector lineage cannot exceed ${MAX_LINEAGE} entries.`);
  const lineage = selector.lineage?.map((entry) => {
    if (!ID_PATTERN.test(entry.kind) || !ID_PATTERN.test(entry.id))
      throw new TypeError('Scope selector lineage requires bounded kind and id values.');
    return Object.freeze({ kind: entry.kind, id: entry.id });
  });
  return Object.freeze({
    kind: selector.kind,
    id: selector.id,
    ...(lineage === undefined ? {} : { lineage: Object.freeze(lineage) }),
  });
}

export function sameSelector(left: ScopeSelector | null | undefined, right: ScopeSelector | null | undefined): boolean {
  if (left == null || right == null) return left === right;
  if (left.kind !== right.kind || left.id !== right.id) return false;
  const leftLineage = left.lineage ?? [];
  const rightLineage = right.lineage ?? [];
  if (leftLineage.length !== rightLineage.length) return false;
  return leftLineage.every(
    (entry, index) => entry.kind === rightLineage[index]?.kind && entry.id === rightLineage[index]?.id,
  );
}

export function freezeResolution(resolution: ScopeResolution): ScopeResolution {
  if (!Number.isSafeInteger(resolution.permissionRevision) || resolution.permissionRevision < 0)
    throw new TypeError('Scope permission revisions must be non-negative safe integers.');
  if (resolution.policyRevision.length === 0 || resolution.policyRevision.length > 128)
    throw new TypeError('Scope policy revisions must be bounded non-empty values.');
  const allowedFeatures = resolution.allowedFeatures?.map((featureId) => {
    if (!ID_PATTERN.test(featureId)) throw new TypeError('Allowed feature IDs must be bounded values.');
    return featureId;
  });
  if ((allowedFeatures?.length ?? 0) > 256) throw new TypeError('A scope cannot authorize more than 256 features.');
  return Object.freeze({
    selector: freezeSelector(resolution.selector),
    permissionRevision: resolution.permissionRevision,
    policyRevision: resolution.policyRevision,
    ...(allowedFeatures === undefined ? {} : { allowedFeatures: Object.freeze([...new Set(allowedFeatures)]) }),
  });
}
