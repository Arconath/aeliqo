#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyT40Smoke } from './t40-smoke-lib.mjs';

const args = process.argv.slice(2);
const allowed = new Set(['--report', '--output', '--corpus', '--config']);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  if (!allowed.has(flag) || value === undefined || options.has(flag))
    throw new Error('Use --report FILE --output FILE --corpus FILE --config FILE');
  options.set(flag, value);
}
if (options.size !== allowed.size) throw new Error('Use --report FILE --output FILE --corpus FILE --config FILE');

const reportPath = resolve(options.get('--report'));
const outputPath = resolve(options.get('--output'));
const corpusPath = resolve(options.get('--corpus'));
const configPath = resolve(options.get('--config'));
const [reportBytes, corpusBytes, configBytes] = await Promise.all([
  readFile(reportPath),
  readFile(corpusPath),
  readFile(configPath),
]);
const corpus = JSON.parse(corpusBytes.toString('utf8'));
if (!Array.isArray(corpus)) throw new Error('The supplied corpus must be a JSON array');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const currentSourceDigest = execFileSync('python3', ['scripts/gate.py', 'digest'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const qualification = {
  ...qualifyT40Smoke(JSON.parse(reportBytes.toString('utf8')), {
    currentSourceDigest,
    corpusSha256: createHash('sha256').update(corpusBytes).digest('hex'),
    corpusPath,
    corpusCases: corpus,
    config: JSON.parse(configBytes.toString('utf8')),
  }),
  reportSha256: createHash('sha256').update(reportBytes).digest('hex'),
  configSha256: createHash('sha256').update(configBytes).digest('hex'),
};
await writeFile(outputPath, JSON.stringify(qualification, null, 2) + '\n');
console.log(JSON.stringify(qualification, null, 2));
