#!/usr/bin/env node
/**
 * Inspect, then optionally deprecate the exact allowlisted obsolete lineages.
 * npm has no archive operation for a package lineage; deprecation is the
 * reversible registry marker while Git/source history remains preserved.
 */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PUBLIC_PACKAGE_NAMES, RELEASE_VERSION, readJson} from './candidate-lib.mjs';
import {NPM_REGISTRY} from './publication-lib.mjs';
import {
  LEGACY_LINEAGES, classifyExactPackage, legacyDeprecationMessage,
} from './legacy-lineage-lib.mjs';

const apply = process.argv.slice(2).includes('--apply');
const value = flag => {
  const index = process.argv.slice(2).indexOf(flag);
  return index === -1 ? undefined : process.argv.slice(2)[index + 1];
};
const confirmation = process.env.AELIQO_CONFIRM_LEGACY_DEPRECATION;
const expectedConfirmation = 'deprecate-obsolete-packages-after-v0.1.0';
const candidatePath = resolve(value('--candidate') ?? 'artifacts/release-candidate/manifest.json');

async function registryPackage(name, version, expectedIntegrity) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `${NPM_REGISTRY}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
      {redirect: 'error', signal: controller.signal, headers: {accept: 'application/json'}},
    );
    let payload;
    try { payload = await response.json(); } catch { payload = undefined; }
    return classifyExactPackage(response.status, payload, name, version, expectedIntegrity);
  } finally {
    clearTimeout(timer);
  }
}

function npm(args) {
  const result = spawnSync('npm', [...args, '--registry', NPM_REGISTRY], {encoding: 'utf8', timeout: 120_000});
  if (result.error || result.status !== 0) {
    throw new Error(`npm ${args[0]} failed\n${result.error?.message ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout.trim();
}

let candidateByName = new Map();
if (apply) {
  const candidate = await readJson(candidatePath);
  if (candidate.version !== RELEASE_VERSION || candidate.packages?.length !== PUBLIC_PACKAGE_NAMES.length) {
    throw new Error('Verified stable candidate has an unexpected release identity');
  }
  candidateByName = new Map(candidate.packages.map(item => [item.name, item]));
  if (candidateByName.size !== PUBLIC_PACKAGE_NAMES.length || PUBLIC_PACKAGE_NAMES.some(name => !candidateByName.has(name))) {
    throw new Error('Verified stable candidate does not contain the exact public package set');
  }
}

const replacements = [];
for (const name of PUBLIC_PACKAGE_NAMES) {
  replacements.push({
    name,
    version: RELEASE_VERSION,
    ...await registryPackage(name, RELEASE_VERSION, candidateByName.get(name)?.integrity),
  });
}
const missingReplacements = replacements.filter(item => item.state !== 'visible');

const legacy = [];
for (const lineage of LEGACY_LINEAGES) {
  const state = await registryPackage(lineage.name, lineage.version);
  legacy.push({
    name: lineage.name,
    version: lineage.version,
    replacement: lineage.replacement,
    state: state.state,
    currentDeprecation: state.deprecated,
    intendedDeprecation: legacyDeprecationMessage(lineage),
  });
}

if (!apply) {
  console.log(JSON.stringify({
    mode: 'read-only',
    replacements,
    legacy,
    readyToDeprecate: missingReplacements.length === 0,
    blockers: missingReplacements.map(item => `${item.name}@${item.version} is not visible`),
  }, null, 2));
  process.exit(0);
}

if (missingReplacements.length) {
  throw new Error(`Refusing legacy deprecation until every replacement is visible: ${missingReplacements.map(item => item.name).join(', ')}`);
}
if (confirmation !== expectedConfirmation) {
  throw new Error(`Set AELIQO_CONFIRM_LEGACY_DEPRECATION=${expectedConfirmation} after owner approval`);
}
const authenticatedUser = npm(['whoami']);
const actions = [];
for (const item of legacy) {
  if (item.state === 'absent') {
    actions.push({name: item.name, version: item.version, action: 'already-unpublished'});
    continue;
  }
  if (item.currentDeprecation === item.intendedDeprecation) {
    actions.push({name: item.name, version: item.version, action: 'verified-existing'});
    continue;
  }
  npm(['deprecate', `${item.name}@${item.version}`, item.intendedDeprecation]);
  const after = await registryPackage(item.name, item.version);
  if (after.state !== 'visible' || after.deprecated !== item.intendedDeprecation) {
    throw new Error(`Registry did not expose the intended deprecation for ${item.name}@${item.version}`);
  }
  actions.push({name: item.name, version: item.version, action: 'deprecated'});
}
console.log(JSON.stringify({mode: 'applied', authenticatedUser, actions}, null, 2));
