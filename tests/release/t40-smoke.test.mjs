import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {qualifyT40Smoke, T40_MCP_TOOL_SCHEMA_SHA256, T40_OBSOLETE_SCOPE_BLOCK} from '../../scripts/release/t40-smoke-lib.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const cases = ['commerce-browse', 'support-weekly', 'hr-record'];
const makeCase = id => {
  const sourceRevision = `${id}-source`;
  return {id, partition: 'heldout', independentAuthor: 'independent fixture author', exposure: 'sealed',
    fixture: {sourceRevision, scopeDigest: `${id}-scope`},
    explicitTask: {id: `${id}-task`, outputs: [{id: 'rows', kind: 'query', query: {}}]},
    expected: [{id: 'rows', fields: ['id', 'value'], grain: ['id'], rows: [{id: 'a', value: 1}], coverage: 'complete',
      quality: {identity: ['id'], populationCount: 1, precision: 'exact', sourceRevisions: {source: sourceRevision},
        evidenceKind: 'observed', definitions: []}}]};
};
const corpusCases = cases.map(makeCase);
const corpusSha256 = 'a'.repeat(64);
const sourceDigest = 'b'.repeat(64);
const corpusPath = '/tmp/aeliqo-authorized-heldout.json';
const budget = {maxTurns: 4, maxModelRequests: 4, maxToolCalls: 3, maxMilliseconds: 120000, maxInputTokens: 20000,
  maxOutputTokens: 1024, maxTotalTokens: 85000, maxInputBytes: 262144, maxOutputBytes: 262144, maxRepeatedCalls: 2};
const weak = {label: 'weak', protocol: 'openai-compatible-chat', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash',
  expectedReportedModel: 'deepseek-flash', credentialEnvironment: 'AELIQO_EVAL_PROVIDER_SECRET', auth: {scheme: 'bearer'},
  capabilities: ['tool-calls', 'usage', 'request-cancellation'], inputUSDPerMillion: 0.44, outputUSDPerMillion: 1.32, priceSource: 'verified test rate'};
const strong = {...weak, label: 'strong', model: 'deepseek-v4-pro', expectedReportedModel: 'deepseek-v4-pro', inputUSDPerMillion: 1.32, outputUSDPerMillion: 3.96};
const config = {version: '1', authorized: true, authorizationReference: 'Owner-authorized bounded release smoke',
  authorizedCorpusSha256: corpusSha256, maxUSD: 1, trials: 1, models: [weak, strong], budget};
const reservation = (budget.maxModelRequests * budget.maxInputTokens * weak.inputUSDPerMillion
  + budget.maxTurns * budget.maxOutputTokens * weak.outputUSDPerMillion) / 1_000_000;
const score = () => ({dataCorrect: true, findings: [], uiTaskCompletion: null, narrativeGrounding: null});
const outputFor = (testCase, resultId = '1'.repeat(64)) => ({descriptor: {version: '1', ref: {id: `result-${resultId}`,
  revision: testCase.fixture.sourceRevision, outputId: 'rows', queryDigest: `query-${'2'.repeat(64)}`, scopeDigest: testCase.fixture.scopeDigest},
taskId: testCase.explicitTask.id, fields: [
  {id: 'id', label: 'ID', type: {value: 'text', nullable: false, grain: ['id']}, role: 'identity'},
  {id: 'value', label: 'Value', type: {value: 'integer', nullable: false, grain: ['id']}, role: 'measure'},
], identity: ['id'], rowGrain: ['id'], counts: {loaded: 1, population: {kind: 'exact', value: 1, populationDigest: `population-${'3'.repeat(64)}`}},
precision: {kind: 'exact'}, coverage: {kind: 'complete', populationDigest: `population-${'3'.repeat(64)}`},
consistency: {kind: 'snapshot', snapshotId: testCase.fixture.sourceRevision, sourceRevisions: {source: testCase.fixture.sourceRevision}},
evidence: {kind: 'observed', source: {id: 'local-source', revision: testCase.fixture.sourceRevision}}, filters: [], warnings: [], lineage: []},
rows: [{id: 'a', value: 1}]});
const deterministic = mode => corpusCases.map((testCase, index) => mode === 'explicit-task'
  ? {caseId: testCase.id, partition: 'heldout', mode, model: null, elapsedMs: 1, score: score(),
    observations: [{stage: 'evaluate', elapsedMs: 1, task: testCase.explicitTask, outputs: [outputFor(testCase, String(index + 1).repeat(64))]}]}
  : {caseId: testCase.id, partition: 'heldout', mode, model: null, score: score(), observation: {
    transport: 'official-sdk-stdio', protocolPin: '2026-07-28', server: {name: 'aeliqo-evaluation-baseline', version: '0.1.0'},
    node: 'v24.20.0', discoveredTools: ['read_catalog', 'evaluate_task'], toolSchemaSha256: T40_MCP_TOOL_SCHEMA_SHA256, receiptState: 'data-ready',
    callElapsedMs: 1, elapsedMs: 2, transportDetached: true, childPid: 123, childExited: true, cleanupSucceeded: true,
    stderrBytes: 0, modelExecution: 'No model adapter is configured.', fixtureProjection: 'Application fixture fields only.', limits: ['Explicit baseline only.'],
  }, outputs: [outputFor(testCase, String(index + 4).repeat(64))]});
const baseLive = (caseId, trial = 1) => {
  const inputTokens = 100;
  const outputTokens = 20;
  return {caseId, partition: 'heldout', mode: 'governed-model-data', model: weak.model, modelLabel: 'weak', qualifiedModelSnapshot: true,
    connection: {protocol: weak.protocol, origin: 'https://api.deepseek.com', authScheme: 'bearer', capabilities: weak.capabilities},
    snapshots: [{reportedModel: 'deepseek-flash', reportedModelSha256: sha('deepseek-flash'), matchesExpected: true, responseIdSha256: sha(`${caseId}:${trial}`)}],
    trial, elapsedMs: 1000, reservedUSD: reservation, firstAttempt: {dataCorrect: false}, score: {dataCorrect: false},
    result: {ok: true, stop: 'text-ready', turns: 3, modelRequests: 1, toolCalls: 2, inputTokens, outputTokens,
      receiptStates: [{operation: 'catalog.read', state: 'data-ready'}, {operation: 'task.evaluate', state: 'data-ready'}]},
    observations: [{stage: 'evaluate', elapsedMs: 1, outputCount: 1, rowCount: 2, diagnosticCodes: []}],
    uiTaskCompletion: null, narrativeGrounding: null, chargedUSD: null,
    usageEstimatedUSD: (inputTokens * weak.inputUSDPerMillion + outputTokens * weak.outputUSDPerMillion) / 1_000_000,
    priceSource: weak.priceSource};
};
const live = cases.map(caseId => baseLive(caseId));
live[1] = {...baseLive(cases[1]), result: {...baseLive(cases[1]).result, toolCalls: 3, receiptStates: [
  {operation: 'catalog.read', state: 'data-ready'}, {operation: 'task.evaluate', state: 'invalid'}, {operation: 'task.evaluate', state: 'data-ready'},
]}, observations: [
  {stage: 'evaluate', elapsedMs: 1, outputCount: 0, rowCount: 0, diagnosticCodes: ['task.shape']},
  {stage: 'evaluate', elapsedMs: 1, outputCount: 1, rowCount: 2, diagnosticCodes: []},
]};
const groups = [
  {label: 'weak', attemptedTrials: 3, unqualifiedTrials: 0, trials: 3, dataCorrect: 0,
    interval: {lower: 0, upper: 0.5614970317550454, confidence: 0.95, trials: 3}, uiTaskCompletion: null, narrativeGrounding: null},
  {label: 'strong', attemptedTrials: 0, unqualifiedTrials: 0, trials: 0, dataCorrect: 0, interval: null, uiTaskCompletion: null, narrativeGrounding: null},
];
const report = {schemaVersion: 1, status: 'blocked', sourceChangedDuringRun: false, mcpExplicit: true, sourceDigest,
  blocks: [T40_OBSOLETE_SCOPE_BLOCK], authorization: {reference: config.authorizationReference, maximumUSD: 1, authorizedCorpusSha256: corpusSha256},
  corpus: {path: corpusPath, sha256: corpusSha256,
    cases: corpusCases.map(({id, partition, independentAuthor, exposure}) => ({id, partition, independentAuthor, exposure})),
    selection: {caseIds: cases, modelLabels: ['weak']}},
  groups, rows: [...deterministic('explicit-task'), ...deterministic('explicit-mcp'), ...live]};
const context = {currentSourceDigest: sourceDigest, corpusSha256, corpusPath, corpusCases, config};

test('qualifies a source/config/corpus-bound Flash integration smoke without requiring live model answer quality', () => {
  const result = qualifyT40Smoke(report, context);
  assert.equal(result.status, 'passed');
  assert.equal(result.invalidThenDataReadyAttempts, 1);
  assert.equal(result.retainedProviderPayloads, 0);
  assert.equal(result.deterministicMcpCorrect, 3);
  assert.equal(result.configuredTrialsPerCase, 1);
});

test('fails closed on forged source, corpus, authorization, blockers, or report fields', () => {
  assert.throws(() => qualifyT40Smoke(report, {...context, currentSourceDigest: 'e'.repeat(64)}), /current source/);
  assert.throws(() => qualifyT40Smoke(report, {...context, corpusSha256: 'e'.repeat(64)}), /configuration|corpus/);
  assert.throws(() => qualifyT40Smoke(report, {...context, config: {...config, authorized: false}}), /owner-authorized/);
  assert.throws(() => qualifyT40Smoke({...report, blocks: [...report.blocks, 'injected']}, context), /blocker|scope claim/);
  assert.throws(() => qualifyT40Smoke({...report, injected: true}, context), /closed evidence schema/);
  assert.throws(() => qualifyT40Smoke(report, {...context, config: {...config, injected: true}}), /closed evidence schema/);
  assert.throws(() => qualifyT40Smoke(report, {...context, config: {...config,
    budget: {...budget, maxInputBytes: 999999999, maxOutputBytes: 999999999, maxRepeatedCalls: 999999999}}}), /budget is invalid/);
  assert.throws(() => qualifyT40Smoke(report, {...context, config: {...config,
    models: [weak, {...strong, model: weak.model}]}}), /distinct weak and strong/);
});

test('rejects unknown rows and provider payloads hidden in live or nested fields', () => {
  const unknownMode = structuredClone(report);
  unknownMode.rows.push({mode: 'raw-provider', content: 'hidden'});
  assert.throws(() => qualifyT40Smoke(unknownMode, context), /unknown or incomplete row modes/);
  const rawPayload = structuredClone(report);
  rawPayload.rows[6].providerPayload = {alias: 'hidden'};
  assert.throws(() => qualifyT40Smoke(rawPayload, context), /closed evidence schema/);
  const nestedPayload = structuredClone(report);
  nestedPayload.rows[6].result.raw = {content: 'hidden'};
  assert.throws(() => qualifyT40Smoke(nestedPayload, context), /closed evidence schema/);
  const snapshotPayload = structuredClone(report);
  snapshotPayload.rows[6].snapshots[0].response = 'hidden';
  assert.throws(() => qualifyT40Smoke(snapshotPayload, context), /closed evidence schema/);
});

test('rejects incomplete trials, failed live outcomes, counter overruns, and spend inconsistencies', () => {
  const duplicate = structuredClone(report);
  duplicate.rows[8].caseId = cases[0];
  assert.throws(() => qualifyT40Smoke(duplicate, context), /contiguous configured set/);
  const failed = structuredClone(report);
  failed.rows[6].result.ok = false;
  assert.throws(() => qualifyT40Smoke(failed, context), /counters exceed/);
  const overBudget = structuredClone(report);
  overBudget.rows[6].result.inputTokens = budget.maxTotalTokens;
  assert.throws(() => qualifyT40Smoke(overBudget, context), /counters exceed/);
  const overSpend = structuredClone(report);
  overSpend.rows[6].reservedUSD *= 2;
  assert.throws(() => qualifyT40Smoke(overSpend, context), /reservation/);
  const missingSnapshot = structuredClone(report);
  missingSnapshot.rows[6].result.modelRequests = 2;
  assert.throws(() => qualifyT40Smoke(missingSnapshot, context), /counters exceed/);
  const replayedSnapshot = structuredClone(report);
  replayedSnapshot.rows[7].snapshots[0].responseIdSha256 = replayedSnapshot.rows[6].snapshots[0].responseIdSha256;
  assert.throws(() => qualifyT40Smoke(replayedSnapshot, context), /identities must be unique/);
});

test('rejects simulated MCP evidence and uncorroborated invalid-repair claims', () => {
  const placeholderDirect = structuredClone(report);
  placeholderDirect.rows[0].observations = [{}];
  assert.throws(() => qualifyT40Smoke(placeholderDirect, context), /closed evidence schema/);
  const placeholderMcp = structuredClone(report);
  placeholderMcp.rows[3].outputs = [{}];
  assert.throws(() => qualifyT40Smoke(placeholderMcp, context), /corpus oracle output/);
  const noMcpOutput = structuredClone(report);
  noMcpOutput.rows[3].outputs = [];
  assert.throws(() => qualifyT40Smoke(noMcpOutput, context), /every corpus oracle output/);
  const fakeMcp = structuredClone(report);
  fakeMcp.rows[3].observation.transportDetached = false;
  assert.throws(() => qualifyT40Smoke(fakeMcp, context), /actual transport observation/);
  const fakeSchema = structuredClone(report);
  fakeSchema.rows[3].observation.toolSchemaSha256 = 'f'.repeat(64);
  assert.throws(() => qualifyT40Smoke(fakeSchema, context), /actual transport observation/);
  const noInvalidDiagnostic = structuredClone(report);
  noInvalidDiagnostic.rows[7].observations[0].diagnosticCodes = [];
  assert.throws(() => qualifyT40Smoke(noInvalidDiagnostic, context), /diagnostic-backed repair/);
  const incompleteText = structuredClone(report);
  for (const row of incompleteText.rows.filter(item => item.mode === 'governed-model-data')) row.result.incompleteRequiredOperations = ['task.evaluate'];
  assert.throws(() => qualifyT40Smoke(incompleteText, context), /without incomplete operations/);
});
