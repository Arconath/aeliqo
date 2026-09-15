#!/usr/bin/env node
/** Read-only npm preflight for a proposed Aeliqo release identity. */
import { PUBLIC_PACKAGE_NAMES } from './candidate-lib.mjs';
import { isReleaseVersion, RELEASE_VERSION } from './metadata.mjs';
import { NPM_REGISTRY, assertRegistryVersionAvailable, classifyRegistryPackageResponse } from './publication-lib.mjs';

const args = process.argv.slice(2);
const versionIndex = args.indexOf('--version');
const version = versionIndex === -1 ? RELEASE_VERSION : args[versionIndex + 1];
if (!isReleaseVersion(version)) {
  throw new Error(`Version must be ${RELEASE_VERSION} or ${RELEASE_VERSION}-rc.N`);
}

async function packageState(name) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`, {
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    return classifyRegistryPackageResponse(response.status, payload, name);
  } finally {
    clearTimeout(timer);
  }
}

const report = { version, registry: NPM_REGISTRY, packages: [] };
const conflicts = [];
for (const name of PUBLIC_PACKAGE_NAMES) {
  const state = await packageState(name);
  try {
    assertRegistryVersionAvailable(name, version, state);
    report.packages.push({ name, status: 'available' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    conflicts.push(message);
    report.packages.push({ name, status: 'unavailable', reason: message });
  }
}

console.log(JSON.stringify(report, null, 2));
if (conflicts.length) {
  throw new Error(`Release version ${version} is unavailable for ${conflicts.length} public package(s)`);
}
