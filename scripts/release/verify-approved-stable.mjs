#!/usr/bin/env node
import { resolve } from 'node:path';
import { readJson } from './candidate-lib.mjs';
import { assertApprovedStable } from './publication-lib.mjs';
import { RELEASE_VERSION } from './metadata.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
function value(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}
const candidatePath = value('--candidate');
const publicationPath = value('--publication');
const consumerPath = value('--consumer');
const sourceRevision = value('--source');
if (!candidatePath || !publicationPath || !consumerPath || !/^[0-9a-f]{40}$/u.test(sourceRevision ?? ''))
  throw new Error('Stable verification needs candidate, publication, consumer, and source SHA');

const [candidate, publication, consumer] = await Promise.all([
  readJson(resolve(root, candidatePath)),
  readJson(resolve(root, publicationPath)),
  readJson(resolve(root, consumerPath)),
]);
assertApprovedStable({ candidate, publication, consumer, version: RELEASE_VERSION, sourceRevision });
console.log(JSON.stringify({ version: RELEASE_VERSION, sourceRevision, packages: candidate.packages.length }));
