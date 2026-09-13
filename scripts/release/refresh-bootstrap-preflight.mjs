#!/usr/bin/env node
/** Refresh the authenticated, post-hold npm snapshot required by first-RC bootstrap. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PUBLIC_PACKAGE_NAMES } from './candidate-lib.mjs';
import { classifyRegistryPackageResponse, NPM_ORG, NPM_OWNER, NPM_REGISTRY } from './publication-lib.mjs';
import { RELEASE_SOURCE_STATUS_ARGS, assertReleaseSourceClean } from './source-state.mjs';

const root = resolve(import.meta.dirname, '../..');
const preflightPath = resolve(root, 'harness/release-preflight.json');
const evidencePath = resolve(root, 'artifacts/release-bootstrap-preflight.json');

function commandJson(commandArgs) {
  const result = spawnSync('npm', [...commandArgs, '--registry', NPM_REGISTRY], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`npm ${commandArgs.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stderr ?? ''}`);
  }
  return JSON.parse(result.stdout);
}

async function expectAbsent(name, version) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const suffix = version === undefined ? '' : `/${encodeURIComponent(version)}`;
    const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}${suffix}`, {
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    let absent = response.status === 404;
    if (!absent && version === undefined && response.status === 200) {
      const payload = await response.json();
      absent = classifyRegistryPackageResponse(response.status, payload, name).exists === false;
    }
    if (!absent)
      throw new Error(
        `Expected ${name}${version ? `@${version}` : ''} to be absent after the hold; registry returned HTTP ${response.status}`,
      );
  } finally {
    clearTimeout(timer);
  }
}

const sourceStatus = spawnSync('git', RELEASE_SOURCE_STATUS_ARGS, {
  cwd: root,
  encoding: 'utf8',
  timeout: 30_000,
});
if (sourceStatus.error || sourceStatus.status !== 0) {
  throw new Error(`Could not inspect the release source worktree\n${sourceStatus.error?.message ?? ''}`);
}
assertReleaseSourceClean(sourceStatus.stdout, 'Running the post-hold preflight');
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
if (revision.error || revision.status !== 0) throw new Error('Could not identify the release source revision');

const preflight = JSON.parse(await readFile(preflightPath, 'utf8'));
const notBefore = Date.parse(preflight.conservativePublishNotBefore ?? '');
const now = Date.now();
if (!Number.isFinite(notBefore) || now < notBefore)
  throw new Error(
    `npm package-name hold remains active until ${preflight.conservativePublishNotBefore ?? 'an unknown time'}`,
  );

const whoami = commandJson(['whoami', '--json']);
const membership = commandJson(['org', 'ls', NPM_ORG, '--json']);
const tfa = commandJson(['profile', 'get', 'tfa', '--json']);
if (whoami !== NPM_OWNER || membership?.[NPM_OWNER] !== 'owner' || tfa?.tfa?.mode !== 'auth-and-writes') {
  throw new Error(`Post-hold preflight requires ${NPM_OWNER} organization-owner authority and auth-and-writes 2FA`);
}
const visible = commandJson(['access', 'list', 'packages', NPM_ORG, '--json']);
if (
  visible === null ||
  typeof visible !== 'object' ||
  Array.isArray(visible) ||
  Object.keys(visible).some((name) => !PUBLIC_PACKAGE_NAMES.includes(name))
) {
  throw new Error(
    'The organization contains an unexpected package after the owner-directed unpublish; inspect registry history before bootstrap',
  );
}

for (const name of PUBLIC_PACKAGE_NAMES) {
  await expectAbsent(name);
  await expectAbsent(name, '0.1.0-rc.1');
}

const observedAt = new Date(now).toISOString();
const refreshed = {
  ...preflight,
  sourceRevision: revision.stdout.trim(),
  observedAt,
  registry: NPM_REGISTRY,
  registryRead: 'verified',
  namespaceAuthority: 'verified',
  namespaceActor: NPM_OWNER,
  packages: PUBLIC_PACKAGE_NAMES.map((name) => ({
    name,
    localVersion: '0.1.0',
    registryStatus: 'public-404-post-hold',
    exactTarget: 'not-visible',
  })),
  postHoldVerifiedAt: observedAt,
  blockedReason: 'owner-bootstrap-not-yet-run',
  availabilityCaveat:
    'Authenticated owner access and public registry reads found the exact direct six-package RC identities absent after the hold. Successful exact first publication remains the registry acceptance proof.',
};
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await writeFile(evidencePath, JSON.stringify(refreshed, null, 2) + '\n');
console.log(
  JSON.stringify(
    { observedAt, actor: NPM_OWNER, packages: PUBLIC_PACKAGE_NAMES.length, preflight: evidencePath },
    null,
    2,
  ),
);
