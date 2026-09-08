import {test} from 'node:test';
import assert from 'node:assert/strict';
import {percentile, firstSubsequent, makeRows, semanticFields, mediumPlan} from './workloads.mjs';

test('nearest-rank p95 uses the tail, not a missing-index zero fallback', () => {
  assert.equal(percentile([5, 1, 4, 2, 3], 0.95), 5);
  assert.equal(percentile([5, 1, 4, 2, 3], 0.5), 3);
});
test('missing or invalid percentile configuration cannot pass a budget', () => {
  for (const fraction of [undefined, NaN, 0, -1, 1.01]) assert.throws(() => percentile([20], fraction));
  for (const observations of [[], [NaN], [Infinity], [-1]]) assert.throws(() => percentile(observations, 0.95));
});
test('measurements retain operation results and predetermined sample counts', async () => {
  let call = 0;
  const result = await firstSubsequent('unit sequence', async () => ({call: ++call}), {firstCount: 2, subsequentCount: 3});
  assert.deepEqual(result.results.first, [{call: 1}, {call: 2}]);
  assert.deepEqual(result.results.subsequent, [{call: 3}, {call: 4}, {call: 5}]);
  assert.equal(result.first.count, 2);
  assert.equal(result.subsequent.count, 3);
});
test('medium records contain every declared semantic field', () => {
  const rows = makeRows(3, 100);
  for (const row of rows) for (const field of semanticFields(100)) assert.ok(Object.hasOwn(row, field.id), field.id);
});

test('the planner workload exercises 64 distinct complete candidates', () => {
  const {candidates} = mediumPlan();
  assert.equal(candidates.length, 64);
  assert.equal(new Set(candidates.map(candidate => JSON.stringify(candidate.plan))).size, 64);
  for (const candidate of candidates) assert.equal(candidate.plan.nodes.length, 31);
});
