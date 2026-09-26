import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const workflow = await readFile(new URL('../../.github/workflows/quality.yml', import.meta.url), 'utf8');
const digest = 'sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7';
function job(name) {
  const block = workflow.match(new RegExp(`^  ${name}:\\n[\\s\\S]*?(?=^  [a-z][a-z-]*:|(?![\\s\\S]))`, 'mu'))?.[0];
  assert.ok(block, `missing ${name} job`);
  return block;
}
test('approved visual gate always participates in quality and uses pinned real container', () => {
  const gate = job('visual');
  assert.match(gate, /needs: policy/u);
  assert.doesNotMatch(gate, /\n    if:|continue-on-error/u);
  assert.ok(gate.includes(`image: mcr.microsoft.com/playwright@${digest}`));
  assert.ok(gate.includes(`AELIQO_VISUAL_CONTAINER_DIGEST: ${digest}`));
  assert.match(gate, /run: node scripts\/visual\/run.mjs --full\n/u);
  assert.match(gate, /fetch-depth: 0/u);
  assert.match(gate, /if: always\(\)/u);
  assert.match(gate, /path: artifacts\/visual-regression/u);
  assert.doesNotMatch(gate, /playwright install|apt-get|update-snapshots/u);
});
test('owner-dispatched full probe is additive and uses the same runner without replacing approved gate', () => {
  const probe = job('visual-probe');
  assert.match(probe, /needs: policy/u);
  assert.match(probe, /if:.*github.event_name == 'workflow_dispatch'.*inputs.visual_probe/u);
  assert.ok(probe.includes(`image: mcr.microsoft.com/playwright@${digest}`));
  assert.ok(probe.includes(`AELIQO_VISUAL_CONTAINER_DIGEST: ${digest}`));
  assert.match(probe, /run: node scripts\/visual\/run.mjs --probe --full/u);
  for (const field of [
    "node-version: '24.20.0'",
    'pnpm@11.24.0',
    'AELIQO_VISUAL_FONT_DIRS: /usr/share/fonts:/usr/local/share/fonts',
    'TZ: UTC',
    'LANG: C.UTF-8',
  ]) {
    assert.ok(probe.includes(field), field);
    assert.ok(job('visual').includes(field), field);
  }
  assert.match(workflow, /visual_probe:[\s\S]*?type: boolean[\s\S]*?default: false/u);
});

test('paired performance gate and same-source probe preserve the required quality boundary', () => {
  const gate = job('performance');
  const probe = job('performance-probe');
  assert.match(gate, /needs: policy/u);
  assert.doesNotMatch(gate, /\n    if:|continue-on-error/u);
  assert.ok(gate.includes(`image: mcr.microsoft.com/playwright@${digest}`));
  assert.match(gate, /run: node scripts\/performance\/compare.mjs\n/u);
  assert.match(gate, /path: artifacts\/performance-paired/u);
  assert.match(probe, /if:.*github.event_name == 'workflow_dispatch'.*inputs.performance_probe/u);
  assert.ok(probe.includes(`image: mcr.microsoft.com/playwright@${digest}`));
  assert.ok(probe.includes('node scripts/performance/compare.mjs --probe --source "$SOURCE_SHA"'));
  assert.match(workflow, /performance_probe:[\s\S]*?type: boolean[\s\S]*?default: false/u);
});
