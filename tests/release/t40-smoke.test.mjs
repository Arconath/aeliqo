import assert from 'node:assert/strict';
import test from 'node:test';
import {qualifyT40Smoke} from '../../scripts/release/t40-smoke-lib.mjs';

const cases = ['commerce-browse', 'support-weekly', 'hr-record'];
const deterministic = mode => cases.map(caseId => ({caseId, mode, score: {dataCorrect: true}}));
const baseLive = caseId => ({
  caseId, mode: 'governed-model-data', model: 'deepseek-v4-flash', modelLabel: 'weak', qualifiedModelSnapshot: true,
  result: {ok: true, stop: 'text-ready', turns: 3, toolCalls: 2, receiptStates: [
    {operation: 'catalog.read', state: 'data-ready'}, {operation: 'task.evaluate', state: 'data-ready'},
  ]},
  observations: [{stage: 'evaluate', rowCount: 2, diagnosticCodes: []}], usageEstimatedUSD: 0.001,
});
const report = {
  schemaVersion: 1, sourceChangedDuringRun: false, mcpExplicit: true, sourceDigest: 'digest',
  corpus: {sha256: 'a'.repeat(64), selection: {caseIds: cases, modelLabels: ['weak']}},
  rows: [
    ...deterministic('explicit-task'), ...deterministic('explicit-mcp'),
    baseLive(cases[0]),
    {...baseLive(cases[1]), result: {...baseLive(cases[1]).result, turns: 4, toolCalls: 3, receiptStates: [
      {operation: 'catalog.read', state: 'data-ready'}, {operation: 'task.evaluate', state: 'invalid'}, {operation: 'task.evaluate', state: 'data-ready'},
    ]}},
    baseLive(cases[2]),
  ],
};

test('qualifies a bounded exact Flash integration smoke without retaining provider payloads', () => {
  const result = qualifyT40Smoke(report);
  assert.equal(result.status, 'passed');
  assert.equal(result.invalidThenDataReadyAttempts, 1);
  assert.equal(result.retainedProviderPayloads, 0);
  assert.equal(result.deterministicMcpCorrect, 3);
});

test('fails closed on missing repair, wrong provider snapshot, or deterministic mismatch', () => {
  const noRepair = structuredClone(report);
  noRepair.rows[7].result.receiptStates = noRepair.rows[6].result.receiptStates;
  assert.throws(() => qualifyT40Smoke(noRepair), /repaired an invalid/);
  const wrongModel = structuredClone(report);
  wrongModel.rows[6].model = 'other';
  assert.throws(() => qualifyT40Smoke(wrongModel), /qualified DeepSeek/);
  const wrongMcp = structuredClone(report);
  wrongMcp.rows[3].score.dataCorrect = false;
  assert.throws(() => qualifyT40Smoke(wrongMcp), /MCP deterministic/);
});
