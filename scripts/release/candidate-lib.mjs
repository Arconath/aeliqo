/**
 * Deterministic checks shared by the candidate builder and its unit tests.
 * This module deliberately has no package-manager dependency: a release gate
 * must be able to inspect the bytes that `pnpm pack` actually produced.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const RELEASE_VERSION = '0.1.0';
export const PUBLIC_PACKAGES = Object.freeze([
  'core', 'runtime', 'web', 'agent', 'devtools', 'react',
]);
export const PUBLIC_PACKAGE_NAMES = Object.freeze(PUBLIC_PACKAGES.map(name => `@aeliqo/${name}`));

const REQUIRED_FILES = new Set(['package/package.json', 'package/README.md', 'package/LICENSE', 'package/NOTICE']);
const ALLOWED_PREFIXES = ['package/dist/', 'package/schemas/'];
const SENSITIVE_NAME = /(?:^|[._-])(?:env|npmrc|pypirc|netrc|credentials?|secrets?|id_rsa|id_ed25519)(?:$|[._-])/i;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha512Integrity(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

export function packageShortName(packageName) {
  if (!PUBLIC_PACKAGE_NAMES.includes(packageName)) throw new Error(`Not a public release package: ${packageName}`);
  return packageName.slice('@aeliqo/'.length);
}

export function assertPublicManifest(manifest, expectedName, expectedVersion = RELEASE_VERSION, {allowWorkspace = false} = {}) {
  if (manifest?.name !== expectedName) throw new Error(`Expected ${expectedName}, received ${manifest?.name ?? 'no package name'}`);
  if (manifest.version !== expectedVersion) throw new Error(`${expectedName} must be version ${expectedVersion}; found ${manifest.version ?? 'none'}`);
  if (manifest.private === true) throw new Error(`${expectedName} must be public`);
  if (manifest.license !== 'Apache-2.0') throw new Error(`${expectedName} must declare Apache-2.0`);
  if (!manifest.exports || typeof manifest.exports !== 'object') throw new Error(`${expectedName} must declare exports`);

  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
      if (PUBLIC_PACKAGE_NAMES.includes(dependency) && version !== expectedVersion && !(allowWorkspace && version === 'workspace:*')) {
        throw new Error(`${expectedName} has non-exact internal ${field} dependency ${dependency}@${version}`);
      }
      if (!allowWorkspace && typeof version === 'string' && version.startsWith('workspace:')) {
        throw new Error(`${expectedName} retains workspace protocol in ${field}: ${dependency}@${version}`);
      }
    }
  }
}

export function assertTarballPaths(paths, packageName) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error(`${packageName} tarball is empty`);
  const files = paths.filter(path => !path.endsWith('/'));
  for (const path of paths) {
    if (!path.startsWith('package/') || path.includes('..') || path.includes('\\')) {
      throw new Error(`${packageName} has unsafe tarball path ${path}`);
    }
  }
  for (const required of REQUIRED_FILES) {
    if (!files.includes(required)) throw new Error(`${packageName} is missing required packed file ${required}`);
  }
  if (!files.some(path => path.startsWith('package/dist/'))) throw new Error(`${packageName} has no compiled dist files`);
  for (const path of files) {
    const relative = path.slice('package/'.length);
    const allowed = REQUIRED_FILES.has(path) || ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix));
    if (!allowed) throw new Error(`${packageName} has non-allowlisted packed file ${path}`);
    if (SENSITIVE_NAME.test(relative)) throw new Error(`${packageName} has sensitive-looking packed file ${path}`);
  }
}

function exportTargets(value, targets = []) {
  if (typeof value === 'string') targets.push(value);
  else if (value && typeof value === 'object') for (const nested of Object.values(value)) exportTargets(nested, targets);
  return targets;
}

export function assertExportTargets(manifest, paths, packageName) {
  const files = new Set(paths.filter(path => !path.endsWith('/')));
  for (const target of exportTargets(manifest.exports)) {
    if (!target.startsWith('./') || target.includes('..')) throw new Error(`${packageName} has unsafe export target ${target}`);
    const packed = `package/${target.slice(2)}`;
    if (target.includes('*')) {
      const prefix = packed.slice(0, packed.indexOf('*'));
      if (!Array.from(files).some(file => file.startsWith(prefix))) throw new Error(`${packageName} export pattern does not match packed files: ${target}`);
    } else if (!files.has(packed)) {
      throw new Error(`${packageName} export target is absent from tarball: ${target}`);
    }
  }
}

export function candidateManifest({sourceRevision, packages, version = RELEASE_VERSION}) {
  const sorted = [...packages].sort((left, right) => left.name.localeCompare(right.name));
  return {
    schema: 'aeliqo.release-candidate.v1',
    sourceRevision,
    version,
    packages: sorted.map(({name, file, sha256: digest, integrity, bytes}) => ({name, version, file, sha256: digest, integrity, bytes})),
  };
}

export function cyclonedxSbom({sourceRevision, packages, version = RELEASE_VERSION}) {
  const byName = new Map(packages.map(item => [item.name, item]));
  const components = [...packages].sort((left, right) => left.name.localeCompare(right.name)).map(item => ({
    type: 'library',
    'bom-ref': `pkg:npm/${item.name.replace('@', '%40').replace('/', '%2F')}@${version}`,
    name: item.name,
    version,
    licenses: [{license: {id: 'Apache-2.0'}}],
    hashes: [{alg: 'SHA-256', content: item.sha256}],
    properties: [
      {name: 'aeliqo:tarball', value: item.file},
      {name: 'aeliqo:source-revision', value: sourceRevision},
    ],
  }));
  const dependencies = [...packages].sort((left, right) => left.name.localeCompare(right.name)).map(item => ({
    ref: `pkg:npm/${item.name.replace('@', '%40').replace('/', '%2F')}@${version}`,
    dependsOn: Object.keys(item.manifest.dependencies ?? {}).filter(name => byName.has(name)).sort().map(name =>
      `pkg:npm/${name.replace('@', '%40').replace('/', '%2F')}@${version}`),
  }));
  return {
    bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
    metadata: {component: {type: 'application', name: 'aeliqo-release-candidate', version, properties: [{name: 'aeliqo:source-revision', value: sourceRevision}]}},
    components, dependencies,
  };
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
