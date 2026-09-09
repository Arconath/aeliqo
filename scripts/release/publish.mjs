#!/usr/bin/env node
/** Fail-closed, resumable publication of an already verified candidate. */
import {spawnSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {classifyRegistryVersionResponse, readJson} from './candidate-lib.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; };
const candidatePath = resolve(root, value('--candidate') ?? 'artifacts/release-candidate/manifest.json');
const output = resolve(root, value('--output') ?? 'artifacts/release-candidate/publication.json');
const tag = value('--tag');
if (!/^(next|rewrite)$/.test(tag ?? '')) throw new Error('--tag must be next or rewrite; latest promotion is a separate deliberate operation');
const candidate = await readJson(candidatePath);
if (!/^0\.1\.0(?:-rc\.[1-9]\d*)?$/.test(candidate.version ?? '') || candidate.packages?.length !== 6) throw new Error('Candidate release identity is invalid');
if (candidate.publishOrder?.join('\n') !== candidate.packages.map(item => item.name).join('\n')) throw new Error('Candidate publication order is missing or inconsistent');

function publishTarball(path) {
  const result = spawnSync('npm', ['publish', path, '--access', 'public', '--provenance', '--tag', tag], {cwd: root, encoding: 'utf8', timeout: 300_000});
  if (result.error || result.status !== 0) throw new Error(`npm publish failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
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
  } finally {
    clearTimeout(timer);
  }
}

const report = {schema: 'aeliqo.npm-publication.v1', sourceRevision: candidate.sourceRevision, version: candidate.version, tag, startedAt: new Date().toISOString(), packages: []};
for (const item of candidate.packages) {
  const before = await registryState(item);
  let action = 'verified-existing';
  if (before.state === 'absent') {
    publishTarball(resolve(candidatePath, '..', item.file));
    action = 'published';
  }
  let after;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt) await new Promise(resolvePromise => setTimeout(resolvePromise, 5_000));
    try { after = await registryState(item); } catch (error) { if (attempt === 5) throw error; }
    if (after?.state === 'verified-existing') break;
  }
  if (after?.state !== 'verified-existing') throw new Error(`Registry did not expose verified ${item.name}@${candidate.version} after publication`);
  report.packages.push({name: item.name, integrity: item.integrity, action});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
report.completedAt = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({version: report.version, tag, packages: report.packages.length, publicationRecord: output}, null, 2));
