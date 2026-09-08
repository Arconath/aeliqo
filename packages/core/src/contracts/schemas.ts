/** Canonical wire shapes. Binding, authorization and business semantics are separate passes. */
import * as z from 'zod/mini';
import {CONTRACT_VERSION, WIRE_LIMITS as L} from './limits.js';

const object = z.strictObject;
const optional = z.optional;
const array = <S extends z.ZodMiniType>(schema: S, maximum: number = L.array) =>
  z.array(schema).check(z.maxLength(maximum));
const nonEmpty = <S extends z.ZodMiniType>(schema: S, maximum: number = L.array) =>
  z.tuple([schema], schema).check(z.maxLength(maximum));
const text = z.string().check(z.maxLength(L.text));
const label = z.string().check(z.minLength(1), z.maxLength(L.label));
const nonnegative = z.number().check(z.minimum(0));
const count = z.int().check(z.minimum(0));
const positiveCount = z.int().check(z.minimum(1));
export const idSchema = z.string().check(z.minLength(1), z.maxLength(L.id), z.regex(/^[^\s\u0000-\u001f\u007f]+$/u));
export const revisionSchema = idSchema;
export const versionRefSchema = object({id: idSchema, revision: revisionSchema});
const ids = array(idSchema);
const refs = array(versionRefSchema);
const version = z.literal(CONTRACT_VERSION);
const record = <S extends z.ZodMiniType>(value: S) => z.record(idSchema, value);
const decimal = object({decimal: z.string().check(z.maxLength(512), z.regex(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/))});
export const valueSchema = z.union([z.null(), z.boolean(), z.number(), text, decimal]);
export const jsonSchema = z.json();
export const semanticTypeSchema = object({
  value: z.enum(['text','boolean','integer','float','decimal','date','instant']),
  nullable: z.boolean(),
  unit: optional(object({dimension: idSchema, symbol: label, currency: optional(idSchema)})),
  grain: optional(ids),
  temporal: optional(object({calendar: idSchema, timezone: optional(idSchema), grain: optional(idSchema)})),
});
export const fieldSchema = object({
  id: idSchema, label, type: semanticTypeSchema,
  role: z.enum(['identity','attribute','dimension','measure','time']), derivation: optional(versionRefSchema),
});
export const relationshipSchema = object({
  id: idSchema, sourceEntity: idSchema, targetEntity: idSchema,
  keys: nonEmpty(object({sourceField: idSchema, targetField: idSchema})),
  cardinality: z.enum(['one-to-one','many-to-one','one-to-many','many-to-many']),
  optional: z.boolean(), joinPolicy: z.enum(['validated','explicit-bridge-required','not-queryable']),
  revision: revisionSchema,
});
export const expressionSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('literal'), value: valueSchema, type: semanticTypeSchema}),
  object({kind: z.literal('field'), ref: idSchema, entity: optional(idSchema)}),
  object({kind: z.literal('definition'), ref: versionRefSchema}),
  object({kind: z.literal('call'), function: versionRefSchema,
    get arguments() {return array(expressionSchema, L.arguments);}}),
]);
export const meaningSchema = object({
  id: idSchema, revision: revisionSchema, label, explanation: text, output: semanticTypeSchema,
  implementation: z.discriminatedUnion('kind', [
    object({kind: z.literal('expression'), expression: expressionSchema}),
    object({kind: z.literal('host-capability'), capability: versionRefSchema}),
  ]),
  dependencies: refs, functionRegistryDigest: idSchema,
  origin: z.enum(['system','manual','ai-assisted']), lifecycle: z.enum(['draft','active','deprecated']),
  scope: z.enum(['session','personal','workspace','organization']),
  authority: z.enum(['hypothesis','reviewed','approved']),
  aggregation: z.enum(['additive','semi-additive','non-additive','ratio-of-sums','none']),
  aggregationDimensions: ids, missingPolicy: z.enum(['propagate','exclude-pair','reject']),
  goal: optional(z.enum(['minimize','maximize'])),
});
export const catalogSchema = object({
  version, revision: revisionSchema, functionRegistryDigest: idSchema,
  entities: array(object({id: idSchema, label, identity: nonEmpty(idSchema),
    rowGrain: nonEmpty(idSchema), fields: array(fieldSchema)})),
  relationships: array(relationshipSchema), meanings: array(meaningSchema),
  capabilities: array(object({ref: versionRefSchema, entity: idSchema, operators: refs,
    fields: ids, relations: refs, maxOutputRows: positiveCount})),
  nextCursor: optional(text),
});
export const periodSchema = object({
  from: z.iso.datetime({offset: true}), toExclusive: z.iso.datetime({offset: true}),
  calendar: idSchema, timezone: idSchema, interpretation: label,
});
export const predicateSchema = z.discriminatedUnion('op', [
  object({op: z.literal('compare'), field: idSchema, entity: optional(idSchema),
    comparison: z.enum(['eq','ne','lt','lte','gt','gte']), value: valueSchema}),
  object({op: z.literal('is-null'), field: idSchema, entity: optional(idSchema), negate: z.boolean()}),
  object({op: z.literal('in'), field: idSchema, entity: optional(idSchema), values: array(valueSchema)}),
  object({op: z.enum(['and','or']), get predicates() {return array(predicateSchema);}}),
  object({op: z.literal('not'), get predicate() {return predicateSchema;}}),
]);
export const resultRefSchema = object({
  id: idSchema, revision: revisionSchema, outputId: idSchema, queryDigest: idSchema, scopeDigest: idSchema,
});
export const populationSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('all-authorized')}),
  object({kind: z.literal('fixed'), source: resultRefSchema, identityKeys: nonEmpty(idSchema), cohortDigest: idSchema}),
  object({kind: z.literal('live-output'), outputId: idSchema, identityKeys: nonEmpty(idSchema)}),
]);
export const querySchema = object({
  entity: idSchema, fields: ids, measures: refs, relations: refs, groupBy: ids,
  relationUsage: optional(array(object({relation: versionRefSchema,
    kind: z.enum(['inner','left','semi']), where: optional(predicateSchema)}))),
  windows: optional(array(object({id: idSchema, function: versionRefSchema,
    arguments: array(expressionSchema, L.arguments), partitionBy: array(expressionSchema),
    orderBy: array(object({expression: expressionSchema, direction: z.enum(['asc','desc']), nulls: z.enum(['first','last'])})),
    frame: object({preceding: count.check(z.maximum(L.array)), following: count.check(z.maximum(L.array))})}))),
  where: optional(predicateSchema), period: optional(periodSchema),
  timeBucket: optional(object({field: idSchema, grain: idSchema, calendar: optional(idSchema), timezone: optional(idSchema), weekStartsOn: optional(z.literal([0, 1, 2, 3, 4, 5, 6]))})), population: populationSchema,
  order: array(object({field: idSchema, direction: z.enum(['asc','desc']), nulls: z.enum(['first','last'])})),
  topK: optional(positiveCount.check(z.maximum(L.array))),
  page: optional(object({size: positiveCount.check(z.maximum(L.array)), cursor: optional(text)})),
});
export const taskOutputSchema = z.discriminatedUnion('kind', [
  object({id: idSchema, kind: z.literal('query'), query: querySchema, dependsOn: ids,
    delivery: z.enum(['eager','on-demand'])}),
  object({id: idSchema, kind: z.literal('reuse'), result: resultRefSchema, dependsOn: z.tuple([])}),
]);
const taskBase = {
  version, id: idSchema, revision: revisionSchema, catalogRevision: revisionSchema,
  functionRegistryDigest: idSchema, regionId: idSchema, goal: label,
  needs: array(object({id: idSchema, operation: versionRefSchema, outputId: optional(idSchema),
    fields: ids, required: z.boolean(), simultaneousGroup: optional(idSchema)})),
  assumptions: array(label),
  viewPreference: optional(object({representation: idSchema, strength: z.enum(['explicit','preferred'])})),
};
export const taskSchema = z.discriminatedUnion('kind', [
  object({...taskBase, kind: z.literal('data'), outputs: nonEmpty(taskOutputSchema, L.outputs)}),
  object({...taskBase, kind: z.literal('presentation'), inputs: array(resultRefSchema)}),
  object({...taskBase, kind: z.literal('form'), schema: versionRefSchema, action: versionRefSchema,
    entityKey: optional(text)}),
]);
export const uncertaintySchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('quantified'), lower: z.number(), upper: z.number(), interpretation: label}),
  object({kind: z.literal('unquantified'), reason: label}),
]);
export const populationCountSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('unknown')}),
  object({kind: z.literal('exact'), value: count, populationDigest: idSchema}),
  object({kind: z.literal('estimated'), value: nonnegative, populationDigest: idSchema,
    method: label, uncertainty: uncertaintySchema}),
]);
export const precisionSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('exact')}),
  object({kind: z.literal('approximate'), method: label, uncertainty: uncertaintySchema}),
]);
export const coverageSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('complete'), populationDigest: idSchema}),
  object({kind: z.literal('partial'), populationDigest: idSchema, reason: label}),
  object({kind: z.literal('sample'), populationDigest: idSchema, method: label}),
  object({kind: z.literal('unknown'), reason: label}),
]);
export const consistencySchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('snapshot'), snapshotId: idSchema, sourceRevisions: record(revisionSchema)}),
  object({kind: z.literal('mixed'), sourceRevisions: record(revisionSchema), reason: label}),
  object({kind: z.literal('unknown'), reason: label}),
]);
export const evidenceSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('observed'), source: versionRefSchema}),
  object({kind: z.literal('computed'), queryDigest: idSchema, definitions: refs}),
  object({kind: z.literal('inferred'), recipe: versionRefSchema, method: label, uncertainty: uncertaintySchema}),
]);
export const diagnosticSchema = object({
  code: idSchema, message: label, path: optional(array(z.union([text, count]), L.depth)),
  remedies: optional(array(label, L.diagnostics)), retryable: z.boolean(),
});
export const resultSchema = object({
  version, ref: resultRefSchema, taskId: idSchema, fields: array(fieldSchema), identity: ids, rowGrain: ids,
  counts: object({loaded: count, population: populationCountSchema}),
  precision: precisionSchema, coverage: coverageSchema, consistency: consistencySchema, evidence: evidenceSchema,
  filters: array(predicateSchema), period: optional(periodSchema), warnings: array(diagnosticSchema, L.diagnostics),
  lineage: array(object({output: idSchema, inputs: array(resultRefSchema)})),
});
export const resultEventSchema = z.discriminatedUnion('kind', [
  object({kind: z.literal('descriptor'), descriptor: resultSchema}),
  object({kind: z.literal('batch'), result: resultRefSchema, sequence: count, rows: array(record(valueSchema))}),
  object({kind: z.literal('progress'), result: resultRefSchema, completed: count, total: optional(count),
    unit: z.enum(['rows','bytes','batches'])}),
  object({kind: z.literal('complete'), result: resultRefSchema, finalCoverage: coverageSchema, cursor: optional(text)}),
  object({kind: z.literal('error'), requestId: idSchema, error: diagnosticSchema}),
]);
export const measurementSchema = z.discriminatedUnion('state', [
  object({state: z.literal('unknown')}), object({state: z.literal('known'), value: nonnegative}),
]);
export const environmentSchema = object({
  inlineSize: measurementSchema, blockSize: measurementSchema, textScale: measurementSchema,
  pointer: z.enum(['fine','coarse','mixed','unknown']), hover: z.enum(['available','unavailable','unknown']),
  keyboard: z.enum(['available','unknown']), locale: idSchema, direction: z.enum(['ltr','rtl']),
  reducedMotion: z.boolean(), forcedColors: z.boolean(),
});
export const experienceSchema = object({
  version, id: idSchema, revision: revisionSchema, mode: z.enum(['fixed','adaptive','composable']),
  agentAllowed: z.boolean(), allowedRepresentations: ids, allowedPatterns: ids,
  composition: object({allowWithoutPreset: z.boolean(), maxNodes: positiveCount.check(z.maximum(L.presentationNodes)),
    maxExpansions: positiveCount}),
  requiredOperations: ids, tokenProfile: versionRefSchema, extensionAllowlist: refs,
  transitionPolicy: z.enum(['stable','explicit-only']),
});
export const commitPreconditionsSchema = object({
  scopeDigest: idSchema, policyRevision: revisionSchema, taskRevision: revisionSchema,
  regionRevision: revisionSchema, catalogRevision: revisionSchema, experienceRevision: revisionSchema,
  functionRegistryDigest: idSchema, results: array(resultRefSchema),
});
export const presentationNodeSchema = object({
  id: idSchema, role: idSchema, representation: versionRefSchema, result: optional(resultRefSchema),
  config: object({schema: versionRefSchema, values: record(jsonSchema)}), children: ids,
});
export const interactionLinkSchema = object({
  id: idSchema, source: object({node: idSchema, port: idSchema}), target: object({node: idSchema, port: idSchema}),
  mapping: versionRefSchema, propagation: z.enum(['directed','identity-equivalence']),
});
export const presentationPlanSchema = object({
  id: idSchema, revision: revisionSchema, rootId: idSchema, preconditions: commitPreconditionsSchema,
  nodes: array(presentationNodeSchema, L.presentationNodes), links: array(interactionLinkSchema, L.links),
  coverage: array(object({needId: idSchema, nodeIds: nonEmpty(idSchema), operations: nonEmpty(versionRefSchema)})),
  stateTransfer: array(object({fromNode: idSchema, toNode: idSchema, mapping: versionRefSchema})),
  diagnostics: array(diagnosticSchema, L.diagnostics),
});
export const selectionSchema = z.discriminatedUnion('mode', [
  object({mode: z.literal('clear')}),
  object({mode: z.literal('ids'), entity: idSchema, keys: nonEmpty(text), result: resultRefSchema}),
  object({mode: z.literal('predicate'), entity: idSchema, predicate: predicateSchema,
    queryDigest: idSchema, populationDigest: idSchema}),
]);
const retainedInteractionPayloads = [
  object({kind: z.literal('selection'), selection: selectionSchema}),
  object({kind: z.literal('filter'), predicates: array(predicateSchema), outputId: idSchema}),
  object({kind: z.literal('range'), field: idSchema, range: z.nullable(periodSchema), outputId: idSchema}),
  object({kind: z.literal('group'), field: idSchema, value: valueSchema, outputId: idSchema}),
  object({kind: z.literal('page'), outputId: idSchema, cursor: text, queryDigest: idSchema}),
] as const;
export const retainedInteractionPayloadSchema = z.discriminatedUnion('kind', retainedInteractionPayloads);
export const interactionPayloadSchema = z.discriminatedUnion('kind', [
  ...retainedInteractionPayloads,
  object({kind: z.literal('navigate'), route: versionRefSchema, params: record(valueSchema)}),
  object({kind: z.literal('draft'), entity: idSchema, key: text, field: idSchema, value: valueSchema, entityRevision: revisionSchema}),
  object({kind: z.literal('action-request'), action: versionRefSchema, input: record(valueSchema)}),
  object({kind: z.literal('extension'), schema: versionRefSchema, value: jsonSchema}),
]);
export const interactionStateSchema = object({
  version,
  values: array(object({nodeId: idSchema, portId: idSchema, payload: retainedInteractionPayloadSchema}), L.links),
  drafts: array(object({domain: idSchema, entity: idSchema, key: text, field: idSchema,
    value: valueSchema, entityRevision: revisionSchema,
    conflict: optional(object({kind: z.literal('entity-stale'), entityRevision: revisionSchema})),
  }), L.presentationNodes),
});
export const interactionSchema = object({
  eventId: idSchema, causationId: idSchema, regionId: idSchema, regionRevision: revisionSchema,
  originNodeId: idSchema, payload: interactionPayloadSchema,
});
export const taskProposalSchema = object({
  requestId: idSchema, targetRegionId: idSchema,
  effect: z.enum(['read','meaning-draft','meaning-activate','present','business-write']),
  preconditions: commitPreconditionsSchema, value: taskSchema,
});
export const meaningDraftSchema = z.extend(z.omit(meaningSchema, {authority: true, lifecycle: true}), {
  lifecycle: z.literal('draft'),
});
export const bindingOutcomeSchema = z.discriminatedUnion('state', [
  object({state: z.literal('bound'), value: taskSchema, interpretation: label, assumptions: array(label)}),
  object({state: z.literal('needs-choice'), choices: nonEmpty(object({id: idSchema, label, consequence: label}))}),
  object({state: z.literal('needs-meaning'), concept: label, authoringRoutes: array(z.enum(['ai-assisted','manual']))}),
  object({state: z.enum(['unsupported','denied','invalid','stale']), diagnostics: nonEmpty(diagnosticSchema, L.diagnostics)}),
]);
export const modelEvaluationSchema = z.discriminatedUnion('state', [
  object({state: z.literal('untested'), reason: label}),
  object({state: z.literal('evaluated'), modelSnapshot: idSchema, recipeDigest: idSchema, corpusDigest: idSchema,
    trials: positiveCount, evidenceId: idSchema, scope: label, permittedGrantsChanged: z.literal(false)}),
]);
export const contractSchemas = Object.freeze({
  catalog: catalogSchema, task: taskSchema, result: resultSchema, experience: experienceSchema,
  expression: expressionSchema, query: querySchema, interaction: interactionSchema,
  'result-event': resultEventSchema, environment: environmentSchema,
  'presentation-plan': presentationPlanSchema, 'task-proposal': taskProposalSchema,
  'meaning-draft': meaningDraftSchema, 'binding-outcome': bindingOutcomeSchema,
  'model-evaluation': modelEvaluationSchema,
});
