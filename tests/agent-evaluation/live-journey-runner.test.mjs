import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLiveJourneyEvaluation, scoreCase } from './live-journey-runner.mjs';

test('negative trial needs a real identified model call and a no-commit stop', () => {
  const testCase = { expectation: { commit: false, representation: null, evidence: null } };
  const state = { tableCount: 0, chartCount: 0, needs: '', text: '' };
  const base = { before: state, after: state, expectedReportedModel: 'deepseek-flash' };
  const zero = scoreCase(testCase, {
    ...base,
    receipt: { stop: 'failed', modelRequests: 0 },
    providerRequests: 0,
    providerModels: [],
  });
  assert.equal(zero.correct, false);
  assert.equal(zero.identityQualified, false);
  const identified = scoreCase(testCase, {
    ...base,
    receipt: { stop: 'no-commit', modelRequests: 1 },
    providerRequests: 1,
    providerModels: ['deepseek-flash'],
  });
  assert.equal(identified.correct, true);
  assert.equal(identified.identityQualified, true);
});

test('dry run records the exact corpus digest and makes no provider or browser call', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aeliqo-live-journeys-'));
  const source = new URL('./j1-j3-corpus.json', import.meta.url);
  const bytes = await readFile(source);
  const corpus = join(directory, 'corpus.json');
  await writeFile(corpus, bytes);
  const report = await runLiveJourneyEvaluation({
    corpusPath: corpus,
    outputDirectory: directory,
    live: false,
    openDriver: () => {
      throw new Error('The dry run tried to open the model/browser driver.');
    },
  });
  assert.equal(report.status, 'blocked');
  assert.equal(report.corpus.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(report.rows.length, 0);
  assert.match(report.blocks.join(' '), /not authorized for execution/u);
});

test('the committed example configuration cannot dispatch a paid model trial', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aeliqo-live-journeys-template-'));
  const report = await runLiveJourneyEvaluation({
    corpusPath: new URL('./j1-j3-corpus.json', import.meta.url).pathname,
    configPath: new URL('./live-journey-config.example.json', import.meta.url).pathname,
    outputDirectory: directory,
    live: true,
    openDriver: () => {
      throw new Error('The unauthorized template opened a model driver.');
    },
  });
  assert.equal(report.status, 'blocked');
  assert.equal(report.rows.length, 0);
  assert.match(report.blocks.join(' '), /authorization/u);
});
