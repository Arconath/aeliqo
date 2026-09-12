import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../../.github/workflows/quality.yml', import.meta.url);
const workflow = await readFile(workflowPath, 'utf8');
const releaseWorkflow = await readFile(new URL('../../.github/workflows/release-publish.yml', import.meta.url), 'utf8');
const policyName = 'Enforce owner-dispatched main or exact candidate source';

function policyScript() {
  const start = workflow.indexOf(`- name: ${policyName}`);
  assert.notEqual(start, -1, 'quality workflow must contain the source policy step');
  const run = workflow.indexOf('      run: |\n', start);
  assert.notEqual(run, -1, 'source policy step must contain a shell script');
  const lines = workflow.slice(run + '      run: |\n'.length).split('\n');
  const body = [];
  for (const line of lines) {
    if (line && !line.startsWith('        ')) break;
    body.push(line.startsWith('        ') ? line.slice(8) : line);
  }
  return body.join('\n');
}

function runPolicy(overrides = {}) {
  return spawnSync('bash', ['-eu', '-o', 'pipefail', '-c', policyScript()], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      EVENT_NAME: 'workflow_dispatch',
      REPOSITORY: 'Arconath/aeliqo',
      ACTOR: 'hermawan22',
      TRIGGERING_ACTOR: 'hermawan22',
      SOURCE_REF: 'refs/heads/main',
      SOURCE_SHA: 'a'.repeat(40),
      EXPECTED_SOURCE_SHA: '',
      ...overrides,
    },
  });
}

test('quality dispatch accepts legacy main and an exact codex candidate', () => {
  assert.equal(runPolicy().status, 0);
  assert.equal(
    runPolicy({
      SOURCE_REF: 'refs/heads/codex/arc22-quality-build-reuse-20260913',
      SOURCE_SHA: 'b'.repeat(40),
      EXPECTED_SOURCE_SHA: 'b'.repeat(40),
    }).status,
    0,
  );
});

test('quality dispatch rejects a wrong actor and a fork', () => {
  assert.notEqual(runPolicy({ ACTOR: 'someone-else' }).status, 0);
  assert.notEqual(runPolicy({ TRIGGERING_ACTOR: 'someone-else' }).status, 0);
  assert.notEqual(runPolicy({ REPOSITORY: 'someone/aeliqo' }).status, 0);
});

test('quality dispatch rejects wrong and malformed candidate SHAs', () => {
  const candidate = { SOURCE_REF: 'refs/heads/codex/candidate', SOURCE_SHA: 'c'.repeat(40) };
  assert.notEqual(runPolicy({ ...candidate, EXPECTED_SOURCE_SHA: 'd'.repeat(40) }).status, 0);
  assert.notEqual(runPolicy({ ...candidate, EXPECTED_SOURCE_SHA: 'not-a-sha' }).status, 0);
});

test('quality dispatch retains the workflow trust and release boundaries', () => {
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(releaseWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseWorkflow, /head_sha == \$sha/);
  assert.match(releaseWorkflow, /head_branch == "main"/);
  assert.match(releaseWorkflow, /conclusion == "success"/);
});
