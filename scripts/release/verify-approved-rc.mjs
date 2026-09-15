#!/usr/bin/env node
import { resolve } from 'node:path';
import { readJson } from './candidate-lib.mjs';
import { assertApprovedRc } from './publication-lib.mjs';
import { RELEASE_VERSION, releaseCandidateNumber } from './metadata.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const candidatePath = value('--candidate');
const publicationPath = value('--publication');
const consumerPath = value('--consumer');
const version = value('--version');
const sourceRevision = value('--source');
const rc = releaseCandidateNumber(version);
if (
  !candidatePath ||
  !publicationPath ||
  !consumerPath ||
  rc === undefined ||
  rc < 1 ||
  !/^[0-9a-f]{40}$/.test(sourceRevision ?? '')
) {
  throw new Error(
    `Approved RC verification requires candidate/publication/consumer files, ${RELEASE_VERSION}-rc.N, and a full source SHA`,
  );
}
const [candidate, publication, consumer] = await Promise.all([
  readJson(resolve(root, candidatePath)),
  readJson(resolve(root, publicationPath)),
  readJson(resolve(root, consumerPath)),
]);
assertApprovedRc({ candidate, publication, consumer, version, sourceRevision });
console.log(
  JSON.stringify({ version, sourceRevision, packages: candidate.packages.length, provenanceVerified: true }, null, 2),
);
