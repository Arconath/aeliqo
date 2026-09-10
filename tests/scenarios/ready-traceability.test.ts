import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, normalize, relative, sep} from 'node:path';
import {describe, expect, it} from 'vitest';
import {readyScenarioTraceability} from '../../fixtures/scenarios/ready-traceability.js';

interface EvidenceRef {
  readonly path: string;
  readonly sha256: string;
}

interface TaskRecord {
  readonly id: string;
  readonly evidence?: readonly EvidenceRef[];
}

interface ScenarioRecord {
  readonly id: string;
  readonly task: string;
  readonly status: string;
  readonly stage: string;
  readonly evidence?: readonly EvidenceRef[];
  readonly nativeHostRequired?: boolean;
  readonly deferredForRelease?: boolean;
}

const root = process.cwd();
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
const tasks = readJson<{readonly tasks: readonly TaskRecord[]}>('harness/tasks.json').tasks;
const scenarios = readJson<{readonly scenarios: readonly ScenarioRecord[]}>('harness/scenarios.json').scenarios;
const taskById = new Map(tasks.map(task => [task.id, task]));
const scenarioById = new Map(scenarios.map(scenario => [scenario.id, scenario]));

const expectedIds = [
  'S01', 'S02', 'S03', 'S04', 'S07', 'S08', 'S09', 'S10', 'S12', 'S13', 'S14',
  'S15', 'S16', 'S17', 'S18', 'S20', 'S21', 'S23', 'S25', 'S26', 'S27',
  'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S37', 'S38', 'S39', 'S40',
  'S43', 'S46', 'S47', 'S48', 'S49', 'S50', 'S51', 'S53', 'S55', 'S56',
  'S57', 'S58', 'S63', 'S64', 'S67',
] as const;

function safePath(path: string): string {
  const candidate = normalize(path);
  expect(candidate).not.toBe('.');
  expect(candidate.startsWith(`..${sep}`) || candidate === '..').toBe(false);
  expect(relative(root, join(root, candidate)).startsWith('..')).toBe(false);
  return join(root, candidate);
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('ready-stage scenario traceability', () => {
  it('indexes exactly the approved deterministic scenario subset', () => {
    const ids = readyScenarioTraceability.map(trace => trace.id);
    expect(ids).toEqual(expectedIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const excluded of ['S22', 'S24', 'S28', 'S36', 'S42', 'S45', 'S52', 'S54', 'S59', 'S61', 'S62']) {
      expect(ids).not.toContain(excluded);
    }
  });

  it.each(readyScenarioTraceability)('$id retains its exact production assertion and immutable evidence link', trace => {
    const scenario = scenarioById.get(trace.id);
    expect(scenario).toBeDefined();
    expect(scenario).toMatchObject({status: 'done', stage: 'ready', nativeHostRequired: false});
    expect(scenario?.deferredForRelease).not.toBe(true);
    expect(trace.sources.length).toBeGreaterThan(0);
    expect(trace.evidence.length).toBeGreaterThan(0);

    expect(scenario?.evidence?.length).toBeGreaterThan(0);
    for (const reference of scenario?.evidence ?? []) {
      const path = safePath(reference.path);
      expect(existsSync(path), `${trace.id}: ${reference.path}`).toBe(true);
      expect(sha256(path), `${trace.id}: ${reference.path}`).toBe(reference.sha256);
    }

    for (const source of trace.sources) {
      const path = safePath(source.path);
      expect(existsSync(path), source.path).toBe(true);
      expect(readFileSync(path, 'utf8'), `${trace.id}: ${source.path}`).toContain(source.marker);
    }

    for (const reference of trace.evidence) {
      const task = taskById.get(reference.taskId);
      expect(task, `${trace.id}: ${reference.taskId}`).toBeDefined();
      const recorded = task?.evidence?.find(item => item.path === reference.path);
      expect(recorded, `${trace.id}: ${reference.path}`).toBeDefined();
      const path = safePath(reference.path);
      expect(existsSync(path), reference.path).toBe(true);
      expect(sha256(path), `${trace.id}: ${reference.path}`).toBe(recorded?.sha256);
    }
  });
});

describe('S48 canonical task ownership', () => {
  it('executes the canonical lease, sibling-prefix, traversal and acceptance-freshness regressions', () => {
    const output = execFileSync('python3', ['tests/harness/test_r2.py'], {
      cwd: root,
      encoding: 'utf8',
      env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'},
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    expect(output).toBe('');
  }, 30_000);
});

const decisionMappings = [
  {ids: ['D01', 'D02', 'D03'], docs: ['MASTER-SOT.md', 'docs/09-experience-dx.md', 'docs/29-component-contracts.md'], tasks: ['T13', 'T16', 'T18', 'T21']},
  {ids: ['D04', 'D05', 'D06'], docs: ['docs/02-data-contract.md'], tasks: ['T06', 'T08']},
  {ids: ['D07', 'D08'], docs: ['docs/03-semantics-derived.md'], tasks: ['T04', 'T23']},
  {ids: ['D09', 'D10', 'D11', 'D12', 'D13'], docs: ['docs/14-agents-protocols.md', 'docs/37-model-failure-containment.md'], tasks: ['T22', 'T24', 'T41']},
  {ids: ['D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20'], docs: ['docs/06-presentation-compiler.md', 'docs/07-ui-grammar.md', 'docs/10-interaction-a11y.md'], tasks: ['T11', 'T19', 'T20', 'T39']},
  {ids: ['D21', 'D22', 'D23'], docs: ['docs/02-data-contract.md', 'docs/04-intent-query.md', 'docs/31-contract-closure.md'], tasks: ['T05', 'T07', 'T09']},
  {ids: ['D24', 'D25', 'D26', 'D27'], docs: ['docs/08-rendering-stack.md', 'docs/09-experience-dx.md'], tasks: ['T02', 'T12', 'T25']},
  {ids: ['D28', 'D29', 'D30'], docs: ['docs/12-performance.md', 'docs/16-quality-gates.md', 'docs/29-component-contracts.md'], tasks: ['T29', 'T30']},
  {ids: ['D31'], docs: ['docs/38-public-site-docs-playground.md'], tasks: ['T27']},
  {ids: ['D32'], docs: ['docs/15-oss-business.md'], tasks: ['T35']},
  {ids: ['D33', 'D34'], docs: ['docs/18-release-migration.md'], tasks: ['T34', 'T42']},
  {ids: ['D35'], docs: ['docs/19-harness.md'], tasks: ['T01']},
  {ids: ['D36'], docs: ['MASTER-SOT.md', 'docs/39-discussion-ledger.md'], tasks: ['T32']},
  {ids: ['D37', 'D38'], docs: ['docs/32-evaluation-plan.md', 'docs/37-model-failure-containment.md'], tasks: ['T40', 'T41']},
] as const;

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.isFile() && /\.(?:ts|json)$/u.test(entry.name) ? [path] : [];
  });
}

describe('S64 master decision and extension-boundary audit', () => {
  it('maps all ledger decisions to canonical documents/tasks and keeps generated rasters non-normative', () => {
    const ledger = readFileSync(join(root, 'docs/39-discussion-ledger.md'), 'utf8');
    const ledgerIds = [...ledger.matchAll(/^\| (D\d{2}) \|/gmu)].map(match => match[1]);
    const expected = Array.from({length: 38}, (_, index) => `D${String(index + 1).padStart(2, '0')}`);
    expect(ledgerIds).toEqual(expected);

    const mapped = decisionMappings.flatMap(group => group.ids);
    expect(mapped).toEqual(expected);
    for (const group of decisionMappings) {
      for (const path of group.docs) expect(existsSync(safePath(path)), path).toBe(true);
      for (const task of group.tasks) expect(taskById.has(task), task).toBe(true);
    }

    const normative = `${readFileSync(join(root, 'MASTER-SOT.md'), 'utf8')}\n${ledger}`;
    expect(normative).not.toMatch(/!\[[^\]]*\]\([^)]*\.(?:png|jpe?g|webp)(?:\?[^)]*)?\)/iu);
    expect(ledger).toContain('Gambar generatif terakhir adalah ilustrasi, bukan kontrak capabilities.');
  });

  it('keeps no-preset composition generic and the pure core free of held-out domain branches', () => {
    const compose = readFileSync(join(root, 'packages/core/src/presentation/validate.ts'), 'utf8');
    expect(compose).toContain('allowWithoutPreset');

    const core = sourceFiles(join(root, 'packages/core/src')).map(path => readFileSync(path, 'utf8')).join('\n');
    expect(core).not.toMatch(/(?:from|import\()\s*['"][^'"]*(?:fixtures|tests|agent-evaluation)/u);
    expect(core).not.toMatch(/\b(?:hr|commerce|support)\.[a-z][a-z0-9-]*/iu);

    const corpus = readJson<{readonly cases: readonly {readonly domain: string}[]}>('fixtures/evaluation/t40-data-query-heldout.manifest.json');
    expect(new Set(corpus.cases.map(item => item.domain))).toEqual(new Set(['hr', 'commerce', 'service-support']));
  });
});
