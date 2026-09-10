#!/usr/bin/env node
/** Fail-closed, resumable publication of an already verified candidate. */
import {spawnSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {basename, dirname, relative, resolve} from 'node:path';
import {classifyRegistryVersionResponse, readJson} from './candidate-lib.mjs';
import {
  NPM_ORG, assertBootstrapAuthority, assertCandidateIdentity,
  assertTagMayAdvance, assertTrustedPublishingContext, expectedIntegrity,
} from './publication-lib.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; };
const bootstrap = args.includes('--bootstrap-first-rc');
const candidatePath = resolve(root, value('--candidate') ?? 'artifacts/release-candidate/manifest.json');
const output = resolve(root, value('--output') ?? 'artifacts/release-candidate/publication.json');
const tag = value('--tag');
if (!/^(next|rewrite)$/.test(tag ?? '')) throw new Error('--tag must be next or rewrite; latest promotion is a separate deliberate operation');
if (relative(root, candidatePath).startsWith('..') || relative(root, output).startsWith('..')) throw new Error('Release paths must remain inside the repository');
const candidate = await readJson(candidatePath);
assertCandidateIdentity(candidate, {bootstrap, tag});

function commandJson(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {cwd: root, encoding: 'utf8', timeout: 60_000});
  if (result.error || result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stderr ?? ''}`);
  return JSON.parse(result.stdout);
}
function gitOutput(commandArgs) {
  const result = spawnSync('git', commandArgs, {cwd: root, encoding: 'utf8', timeout: 30_000});
  if (result.error || result.status !== 0) throw new Error(`git ${commandArgs.join(' ')} failed`);
  return result.stdout.trim();
}
function publishTarball(path) {
  const publishArgs = ['publish', path, '--access', 'public'];
  if (!bootstrap) publishArgs.push('--provenance');
  publishArgs.push('--tag', tag);
  const options = bootstrap
    ? {cwd: root, stdio: 'inherit', timeout: 300_000}
    : {cwd: root, encoding: 'utf8', timeout: 300_000};
  const result = spawnSync('npm', publishArgs, options);
  if (result.error || result.status !== 0) throw new Error(`npm publish failed${bootstrap ? '' : `\n${result.stdout ?? ''}\n${result.stderr ?? ''}`}`);
}
async function registryState(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(item.name)}/${encodeURIComponent(candidate.version)}`;
    const response = await fetch(url, {redirect: 'error', signal: controller.signal, headers: {accept: 'application/json'}});
    let payload;
    try { payload = await response.json(); } catch { payload = undefined; }
    return classifyRegistryVersionResponse(response.status, payload, item.name, candidate.version, item.integrity);
  } finally { clearTimeout(timer); }
}
async function registryTag(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(item.name)}`, {redirect: 'error', signal: controller.signal, headers: {accept: 'application/json'}});
    if (response.status === 404) return undefined;
    if (response.status !== 200) throw new Error(`Registry returned HTTP ${response.status} for ${item.name} dist-tags`);
    const payload = await response.json();
    const selected = payload?.['dist-tags']?.[tag];
    if (selected !== undefined && typeof selected !== 'string') throw new Error(`Registry returned malformed ${item.name} dist-tag ${tag}`);
    return selected;
  } finally { clearTimeout(timer); }
}

const head = gitOutput(['rev-parse', 'HEAD']);
if (candidate.sourceRevision !== head) throw new Error('Candidate source revision differs from the checked-out source');
if (gitOutput(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Refusing to publish from modified tracked files');
if (bootstrap) {
  assertBootstrapAuthority({
    whoami: commandJson('npm', ['whoami', '--json']),
    membership: commandJson('npm', ['org', 'ls', NPM_ORG, '--json']),
    tfa: commandJson('npm', ['profile', 'get', 'tfa', '--json']),
    stdinTTY: process.stdin.isTTY, stdoutTTY: process.stdout.isTTY, stderrTTY: process.stderr.isTTY,
    ci: Boolean(process.env.CI || process.env.GITHUB_ACTIONS),
  });
} else assertTrustedPublishingContext(process.env, candidate.sourceRevision);

const prepared = [];
for (const item of candidate.packages) {
  if (basename(item.file) !== item.file || !/^aeliqo-sdk-[a-z]+-0\.1\.0(?:-rc\.[1-9]\d*)?\.tgz$/.test(item.file)) throw new Error(`Unsafe candidate tarball name for ${item.name}`);
  const tarball = resolve(dirname(candidatePath), item.file);
  if (relative(dirname(candidatePath), tarball).startsWith('..')) throw new Error(`Candidate tarball escapes its directory for ${item.name}`);
  expectedIntegrity(await readFile(tarball), item);
  const before = await registryState(item);
  const beforeTag = await registryTag(item);
  assertTagMayAdvance({name: item.name, tag, desiredVersion: candidate.version, currentVersion: beforeTag, versionAlreadyExists: before.state === 'verified-existing'});
  prepared.push({item, tarball, before});
}

const report = {
  schema: 'aeliqo.npm-publication.v2', sourceRevision: candidate.sourceRevision,
  version: candidate.version, tag, mode: bootstrap ? 'interactive-owner-bootstrap' : 'trusted-publishing',
  startedAt: new Date().toISOString(), packages: [],
};
for (const {item, tarball, before} of prepared) {
  let action = 'verified-existing';
  if (before.state === 'absent') { publishTarball(tarball); action = 'published'; }
  let after;
  let afterTag;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt) await new Promise(resolvePromise => setTimeout(resolvePromise, 5_000));
    try { after = await registryState(item); afterTag = await registryTag(item); } catch (error) { if (attempt === 5) throw error; }
    if (after?.state === 'verified-existing' && afterTag === candidate.version) break;
  }
  if (after?.state !== 'verified-existing') throw new Error(`Registry did not expose verified ${item.name}@${candidate.version} after publication`);
  if (afterTag !== candidate.version) throw new Error(`Registry dist-tag ${tag} does not select verified ${item.name}@${candidate.version}`);
  report.packages.push({name: item.name, integrity: item.integrity, distTag: tag, action});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
report.completedAt = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({version: report.version, tag, mode: report.mode, packages: report.packages.length, publicationRecord: output}, null, 2));
