import * as z from 'zod/mini';
import {inspectWire} from '../contracts/ingress.js';
import {meaningSchema} from '../contracts/schemas.js';
import type {Catalog, MeaningDefinition, Outcome, VersionRef} from '../contracts/types.js';
import {checkExpression} from '../expressions/check.js';
import type {FunctionRegistry} from '../expressions/types.js';
import {createCatalogIndex, versionKey} from './catalog.js';
import {isRecord, prependOutcomePath, semanticFailure} from './errors.js';
import {sameStringSet, validateSemanticType} from './type-utils.js';
import type {CatalogIndex, MeaningActivationPolicy, MeaningActivationReceipt, MeaningBundle, MeaningBundleContext, SemanticPolicy} from './types.js';

export interface MeaningValidationContext extends MeaningBundleContext {
  readonly index?: CatalogIndex;
  readonly entityId?: string;
}

const authorityRank: Record<MeaningDefinition['authority'], number> = {
  hypothesis: 0,
  reviewed: 1,
  approved: 2,
};

/**
 * Activation is an effect boundary owned by the host. A definition's
 * `authority`/`lifecycle` labels are validated data, not credentials. This
 * helper requires an immutable host allowlist before returning any receipt.
 */
export function authorizeMeaningActivation(
  meaning: MeaningDefinition,
  policy: MeaningActivationPolicy,
): Outcome<MeaningActivationReceipt> {
  if (!isRecord(meaning) || typeof meaning.id !== 'string' || typeof meaning.revision !== 'string')
    return semanticFailure('semantic.activation-meaning', 'Activation requires a canonical meaning definition.', ['meaning']);
  if (!isRecord(policy) || typeof policy.policyRevision !== 'string' || !Array.isArray(policy.allowlistedDefinitions))
    return semanticFailure('semantic.activation-policy', 'Activation requires a canonical host policy with exact definitions.', ['policy']);
  if (policy.policyRevision.length === 0)
    return semanticFailure('semantic.activation-policy', 'Activation policy must pin a nonempty revision.', ['policyRevision']);
  if (meaning.lifecycle !== 'active')
    return semanticFailure('semantic.activation-lifecycle', 'Only active meanings may be considered for activation.', ['lifecycle']);
  const identity = versionKey(meaning);
  const canonical = policy.allowlistedDefinitions.find((candidate) => isRecord(candidate) && typeof candidate.id === 'string' && typeof candidate.revision === 'string' && versionKey(candidate as VersionRef) === identity);
  if (canonical === undefined || stableJSON(canonical) !== stableJSON(meaning))
    return semanticFailure('semantic.activation-denied', 'The exact canonical meaning contents are not allowlisted by host policy.', ['id', 'revision']);
  if (policy.allowlistedRefs !== undefined && (!Array.isArray(policy.allowlistedRefs) || !policy.allowlistedRefs.some((ref) => isRecord(ref) && typeof ref.id === 'string' && typeof ref.revision === 'string' && versionKey(ref as VersionRef) === identity)))
    return semanticFailure('semantic.activation-denied', 'The immutable meaning reference is not allowlisted by host policy.', ['id', 'revision']);
  if (policy.minAuthority !== undefined && authorityRank[meaning.authority] < authorityRank[policy.minAuthority])
    return semanticFailure('semantic.activation-authority', `Activation policy requires ${policy.minAuthority} authority.`, ['authority']);
  return {ok: true, value: {state: 'authorized', meaning: {id: meaning.id, revision: meaning.revision}, policyRevision: policy.policyRevision}};
}

export function validateMeaning(input: unknown, context: MeaningValidationContext): Outcome<MeaningDefinition> {
  const inspected = inspectWire(input);
  if (!inspected.ok) return inspected;
  const parsed = z.safeParse(meaningSchema, inspected.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return semanticFailure('semantic.shape', 'Meaning does not match the canonical meaning contract.', issue?.path.filter((part): part is string | number => typeof part !== 'symbol'));
  }
  const meaning = parsed.data as MeaningDefinition;
  if (context.registry.digest !== context.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-registry', 'The supplied function registry does not match the catalog registry pin.', ['functionRegistryDigest']);
  const indexOutcome = context.index === undefined ? createCatalogIndex(context.catalog) : {ok: true as const, value: context.index};
  if (!indexOutcome.ok) return indexOutcome;
  const index = indexOutcome.value;
  if (index.catalog.revision !== context.catalog.revision || index.catalog.functionRegistryDigest !== context.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-catalog-index', 'The supplied catalog index belongs to a different catalog revision or function registry pin.', ['catalog']);
  const definitions = context.definitions ?? [];

  if (meaning.functionRegistryDigest !== context.registry.digest)
    return semanticFailure('semantic.stale-registry', 'Meaning pins a different function registry digest.', ['functionRegistryDigest']);
  const outputType = validateSemanticType(meaning.output, ['output']);
  if (!outputType.ok) return outputType;
  const policyResult = validatePolicy(meaning, context.policy);
  if (!policyResult.ok) return policyResult;

  if (new Set(meaning.dependencies.map(versionKey)).size !== meaning.dependencies.length)
    return semanticFailure('semantic.duplicate-dependency', 'Meaning dependencies must be unique.', ['dependencies']);
  const available = new Map<string, MeaningDefinition>();
  for (const candidate of context.catalog.meanings) available.set(versionKey(candidate), candidate);
  for (const candidate of definitions) {
    const identity = versionKey(candidate);
    const prior = available.get(identity);
    if (prior !== undefined && stableJSON(prior) !== stableJSON(candidate))
      return semanticFailure('semantic.definition-conflict', `Meaning ${candidate.id}@${candidate.revision} conflicts with an existing definition.`, ['definitions']);
    if (prior === undefined) available.set(identity, candidate);
  }
  const existing = available.get(versionKey(meaning));
  if (existing !== undefined && stableJSON(existing) !== stableJSON(meaning))
    return semanticFailure('semantic.definition-conflict', `Meaning ${meaning.id}@${meaning.revision} conflicts with an existing definition.`, ['id', 'revision']);

  for (let indexOfDependency = 0; indexOfDependency < meaning.dependencies.length; indexOfDependency += 1) {
    const dependency = meaning.dependencies[indexOfDependency]!;
    const dependencyMeaning = available.get(versionKey(dependency));
    if (dependencyMeaning === undefined)
      return semanticFailure('semantic.unknown-dependency', `Meaning dependency ${versionKey(dependency)} is not available.`, ['dependencies', indexOfDependency]);
    if (dependencyMeaning.functionRegistryDigest !== context.registry.digest)
      return semanticFailure('semantic.stale-registry', `Meaning dependency ${dependencyMeaning.id}@${dependencyMeaning.revision} pins a different function registry digest.`, ['dependencies', indexOfDependency]);
  }

  if (meaning.implementation.kind === 'host-capability') {
    if (context.policy?.allowHostCapabilities === false)
      return semanticFailure('semantic.host-capability-denied', 'Host-backed meanings are not allowed by this policy.', ['implementation', 'capability']);
    if (index.resolveCapability(meaning.implementation.capability) === undefined)
      return semanticFailure('semantic.unknown-capability', `Capability ${versionKey(meaning.implementation.capability)} is not declared.`, ['implementation', 'capability']);
  } else {
    const checked = checkExpression(meaning.implementation.expression, {
      catalog: context.catalog,
      index,
      registry: context.registry,
      definitions,
      ...(context.entityId === undefined ? {} : {entityId: context.entityId}),
      expectedType: meaning.output,
    });
    if (!checked.ok) return checked;
    for (const dependency of collectDefinitionRefs(checked.value.expression)) {
      if (!meaning.dependencies.some((candidate) => versionKey(candidate) === versionKey(dependency)))
        return semanticFailure('semantic.unlisted-dependency', `Expression references ${versionKey(dependency)} without listing it as a dependency.`, ['implementation', 'expression']);
    }
    const operation = checked.value.operation;
    if (operation === 'ratio-of-sums' && meaning.aggregation !== 'ratio-of-sums')
      return semanticFailure('semantic.aggregation-mismatch', 'A ratio-of-sums expression must declare ratio-of-sums aggregation.', ['aggregation']);
    if (operation === 'mean-of-rates' && meaning.aggregation !== 'non-additive')
      return semanticFailure('semantic.aggregation-mismatch', 'Mean-of-rates must declare non-additive aggregation.', ['aggregation']);
    if (meaning.aggregation === 'ratio-of-sums' && operation !== 'ratio-of-sums')
      return semanticFailure('semantic.aggregation-mismatch', 'Ratio-of-sums aggregation requires a ratio-of-sums function identity.', ['implementation', 'expression']);
  }

  if (new Set(meaning.aggregationDimensions).size !== meaning.aggregationDimensions.length)
    return semanticFailure('semantic.aggregation-grain', 'Aggregation dimensions must be unique.', ['aggregationDimensions']);
  if (meaning.aggregationDimensions.length > 0) {
    const grain = meaning.output.grain ?? [];
    if (!sameStringSet(meaning.aggregationDimensions, meaning.aggregationDimensions.filter((dimension) => grain.includes(dimension))))
      return semanticFailure('semantic.aggregation-grain', 'Aggregation dimensions must be declared output grain dimensions.', ['aggregationDimensions']);
  }
  return {ok: true, value: meaning};
}

export function validateMeaningBundle(input: unknown, context: MeaningBundleContext): Outcome<MeaningBundle> {
  if (!isRecord(input)) return semanticFailure('semantic.bundle-shape', 'Meaning bundle must be a plain object.');
  if (typeof input.catalogRevision !== 'string' || input.catalogRevision.length === 0)
    return semanticFailure('semantic.bundle-catalog', 'Meaning bundle must pin a catalog revision.', ['catalogRevision']);
  if (typeof input.functionRegistryDigest !== 'string' || input.functionRegistryDigest.length === 0)
    return semanticFailure('semantic.bundle-registry', 'Meaning bundle must pin a function registry digest.', ['functionRegistryDigest']);
  if (!Array.isArray(input.meanings)) return semanticFailure('semantic.bundle-meanings', 'Meaning bundle meanings must be an array.', ['meanings']);
  if (input.catalogRevision !== context.catalog.revision)
    return semanticFailure('semantic.stale-catalog', 'Meaning bundle was authored against a different catalog revision.', ['catalogRevision']);
  if (input.functionRegistryDigest !== context.registry.digest)
    return semanticFailure('semantic.stale-registry', 'Meaning bundle pins a different function registry digest.', ['functionRegistryDigest']);
  if (context.registry.digest !== context.catalog.functionRegistryDigest)
    return semanticFailure('semantic.stale-registry', 'The supplied function registry does not match the catalog registry pin.', ['functionRegistryDigest']);
  const indexOutcome = createCatalogIndex(context.catalog);
  if (!indexOutcome.ok) return indexOutcome;
  const inheritedMeanings = new Map<string, MeaningDefinition>();
  for (const candidate of [...(context.definitions ?? []), ...context.catalog.meanings]) {
    const identity = versionKey(candidate);
    const prior = inheritedMeanings.get(identity);
    if (prior !== undefined && stableJSON(prior) !== stableJSON(candidate))
      return semanticFailure('semantic.definition-conflict', `Meaning ${candidate.id}@${candidate.revision} conflicts with an inherited definition.`, ['meanings']);
    if (prior === undefined) inheritedMeanings.set(identity, candidate);
  }
  // Index the full bundle before semantic validation so dependency checks are
  // independent of declaration order and cycles are reported as cycles.
  const suppliedMeanings: MeaningDefinition[] = [];
  const suppliedByIdentity = new Map<string, MeaningDefinition>();
  for (let index = 0; index < input.meanings.length; index += 1) {
    const inspected = inspectWire(input.meanings[index]);
    if (!inspected.ok) return prependOutcomePath(['meanings', index], inspected);
    const parsed = z.safeParse(meaningSchema, inspected.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return semanticFailure('semantic.shape', 'Meaning does not match the canonical meaning contract.', ['meanings', index, ...(issue?.path.filter((part): part is string | number => typeof part !== 'symbol') ?? [])]);
    }
    const candidate = parsed.data as MeaningDefinition;
    const identity = versionKey(candidate);
    const prior = suppliedByIdentity.get(identity);
    if (prior !== undefined && stableJSON(prior) !== stableJSON(candidate))
      return semanticFailure('semantic.definition-conflict', `Meaning ${candidate.id}@${candidate.revision} has conflicting bundle contents.`, ['meanings', index]);
    if (prior === undefined) suppliedByIdentity.set(identity, candidate);
    suppliedMeanings.push(candidate);
  }
  const bundleMeanings: MeaningDefinition[] = [];
  const seen = new Map<string, MeaningDefinition>();
  for (let index = 0; index < suppliedMeanings.length; index += 1) {
    const validated = validateMeaning(suppliedMeanings[index], {
      ...context,
      index: indexOutcome.value,
      definitions: [...(context.definitions ?? []), ...suppliedMeanings],
    });
    if (!validated.ok) return prependOutcomePath(['meanings', index], validated);
    const identity = versionKey(validated.value);
    const inherited = [...(context.definitions ?? []), ...context.catalog.meanings].find((candidate) => versionKey(candidate) === identity);
    if (inherited !== undefined && stableJSON(inherited) !== stableJSON(validated.value))
      return semanticFailure('semantic.definition-conflict', `Meaning ${validated.value.id}@${validated.value.revision} conflicts with an existing definition.`, ['meanings', index]);
    const prior = seen.get(identity);
    if (prior !== undefined && stableJSON(prior) !== stableJSON(validated.value))
      return semanticFailure('semantic.definition-conflict', `Meaning ${identity} has conflicting contents.`, ['meanings', index]);
    if (prior === undefined) {
      seen.set(identity, validated.value);
      bundleMeanings.push(validated.value);
    }
  }

  const byIdentity = new Map<string, MeaningDefinition>();
  for (const meaning of [...(context.definitions ?? []), ...context.catalog.meanings, ...bundleMeanings]) byIdentity.set(versionKey(meaning), meaning);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (meaning: MeaningDefinition, path: readonly (string | number)[]): Outcome<void> => {
    const identity = versionKey(meaning);
    if (visiting.has(identity)) return semanticFailure('semantic.cycle', `Meaning dependency cycle includes ${identity}.`, path);
    if (visited.has(identity)) return {ok: true, value: undefined};
    visiting.add(identity);
    for (let index = 0; index < meaning.dependencies.length; index += 1) {
      const dependency = byIdentity.get(versionKey(meaning.dependencies[index]!));
      if (dependency === undefined) return semanticFailure('semantic.unknown-dependency', `Meaning dependency ${versionKey(meaning.dependencies[index]!)} is not available.`, [...path, 'dependencies', index]);
      const result = visit(dependency, [...path, 'dependencies', index]);
      if (!result.ok) return result;
    }
    visiting.delete(identity);
    visited.add(identity);
    return {ok: true, value: undefined};
  };
  for (let index = 0; index < bundleMeanings.length; index += 1) {
    const result = visit(bundleMeanings[index]!, ['meanings', index]);
    if (!result.ok) return result;
  }
  return {ok: true, value: {catalogRevision: input.catalogRevision, functionRegistryDigest: input.functionRegistryDigest, meanings: bundleMeanings}};
}

function validatePolicy(meaning: MeaningDefinition, policy: SemanticPolicy | undefined): Outcome<void> {
  if (policy?.allowedScopes !== undefined && !policy.allowedScopes.includes(meaning.scope))
    return semanticFailure('semantic.scope', `Meaning scope ${meaning.scope} is not permitted by this policy.`, ['scope']);
  if (meaning.lifecycle === 'active' && policy?.minAuthorityForActive !== undefined && authorityRank[meaning.authority] < authorityRank[policy.minAuthorityForActive])
    return semanticFailure('semantic.authority', `Active meaning requires ${policy.minAuthorityForActive} authority under this policy.`, ['authority']);
  return {ok: true, value: undefined};
}

function collectDefinitionRefs(expression: import('../contracts/types.js').Expression): readonly VersionRef[] {
  const refs: VersionRef[] = [];
  const stack = [expression];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === 'definition') refs.push(node.ref);
    if (node.kind === 'call') for (let index = node.arguments.length - 1; index >= 0; index -= 1) stack.push(node.arguments[index]!);
  }
  return refs;
}

function stableJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? '';
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(object[key])}`).join(',')}}`;
}
