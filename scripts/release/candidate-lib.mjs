/**
 * Deterministic checks shared by the candidate builder and its unit tests.
 * This module deliberately has no package-manager dependency: a release gate
 * must be able to inspect the bytes that `pnpm pack` actually produced.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const RELEASE_VERSION = '0.1.0';
// Dependency order is publication order. Keep this explicit and fail closed if
// a future manifest introduces an edge to a package later in the list.
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

export function assertPublishOrder(packages) {
  const positions = new Map(packages.map((item, index) => [item.name, index]));
  if (positions.size !== PUBLIC_PACKAGE_NAMES.length || PUBLIC_PACKAGE_NAMES.some(name => !positions.has(name))) {
    throw new Error('Publish set must contain each public package exactly once');
  }
  for (const [index, item] of packages.entries()) {
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const dependency of Object.keys(item.manifest[field] ?? {})) {
        const dependencyIndex = positions.get(dependency);
        if (dependencyIndex !== undefined && dependencyIndex >= index) {
          throw new Error(`${item.name} must be published after internal ${field} dependency ${dependency}`);
        }
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

export function exportSpecifiers(manifest, paths) {
  const files = paths.filter(path => !path.endsWith('/'));
  const specifiers = new Set();
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (!key.includes('*')) {
      specifiers.add(key === '.' ? manifest.name : `${manifest.name}${key.slice(1)}`);
      continue;
    }
    for (const target of exportTargets(value)) {
      if (!target.includes('*')) continue;
      const packed = `package/${target.slice(2)}`;
      const marker = packed.indexOf('*');
      const prefix = packed.slice(0, marker);
      const suffix = packed.slice(marker + 1);
      for (const file of files) {
        if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;
        const wildcard = file.slice(prefix.length, file.length - suffix.length || undefined);
        specifiers.add(`${manifest.name}${key.slice(1).replace('*', wildcard)}`);
      }
    }
  }
  return [...specifiers].sort();
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
  assertPublishOrder(packages);
  return {
    schema: 'aeliqo.release-candidate.v1',
    sourceRevision,
    version,
    publishOrder: packages.map(item => item.name),
    packages: packages.map(({name, file, sha256: digest, integrity, bytes}) => ({name, version, file, sha256: digest, integrity, bytes})),
  };
}

export function packagePurl(name, version) {
  const path = name.startsWith('@')
    ? `${encodeURIComponent(name.slice(0, name.indexOf('/')))}/${encodeURIComponent(name.slice(name.indexOf('/') + 1))}`
    : encodeURIComponent(name);
  return `pkg:npm/${path}@${encodeURIComponent(version)}`;
}

export function integrityToCycloneDxHash(integrity) {
  const match = /^(sha256|sha512)-([A-Za-z0-9+/=]+)$/.exec(integrity ?? '');
  if (!match) throw new Error(`Unsupported package integrity ${integrity ?? 'none'}`);
  return {alg: match[1] === 'sha256' ? 'SHA-256' : 'SHA-512', content: Buffer.from(match[2], 'base64').toString('hex')};
}

export function pnpmLockIntegrities(lockText) {
  const result = new Map();
  let inPackages = false;
  let current;
  for (const line of lockText.split(/\r?\n/)) {
    if (line === 'packages:') { inPackages = true; continue; }
    if (line === 'snapshots:') break;
    if (!inPackages) continue;
    const key = /^  (?:'([^']+)'|([^:\s]+)):\s*$/.exec(line);
    if (key) { current = key[1] ?? key[2]; continue; }
    const integrity = /^    resolution: \{integrity: ([^}]+)\}/.exec(line);
    if (current && integrity) result.set(current, integrity[1]);
  }
  return result;
}

export function cyclonedxSbom({sourceRevision, packages, externalComponents = [], dependencies = [], version = RELEASE_VERSION}) {
  const internalComponents = [...packages].sort((left, right) => left.name.localeCompare(right.name)).map(item => ({
    type: 'library',
    'bom-ref': packagePurl(item.name, version),
    purl: packagePurl(item.name, version),
    name: item.name,
    version,
    licenses: [{license: {id: 'Apache-2.0'}}],
    hashes: [{alg: 'SHA-256', content: item.sha256}],
    properties: [
      {name: 'aeliqo:tarball', value: item.file},
      {name: 'aeliqo:source-revision', value: sourceRevision},
    ],
  }));
  const external = [...externalComponents].sort((left, right) => left.ref.localeCompare(right.ref)).map(item => ({
    type: 'library',
    'bom-ref': item.ref,
    purl: item.ref,
    name: item.name,
    version: item.version,
    licenses: [{license: {name: item.license}}],
    hashes: [integrityToCycloneDxHash(item.integrity)],
  }));
  return {
    bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
    metadata: {component: {type: 'application', name: 'aeliqo-release-candidate', version, properties: [{name: 'aeliqo:source-revision', value: sourceRevision}]}},
    components: [...internalComponents, ...external],
    dependencies: [...dependencies].sort((left, right) => left.ref.localeCompare(right.ref)).map(item => ({
      ref: item.ref,
      dependsOn: [...new Set(item.dependsOn)].sort(),
    })),
  };
}

export function classifyRegistryVersionResponse(status, payload, expectedName, expectedVersion, expectedIntegrity) {
  if (status === 404) return {state: 'absent'};
  if (status !== 200) throw new Error(`Registry returned HTTP ${status} for ${expectedName}@${expectedVersion}`);
  if (payload?.name !== expectedName || payload?.version !== expectedVersion) {
    throw new Error(`Registry returned the wrong identity for ${expectedName}@${expectedVersion}`);
  }
  if (payload?.dist?.integrity !== expectedIntegrity) {
    throw new Error(`${expectedName}@${expectedVersion} exists with different bytes`);
  }
  return {state: 'verified-existing', integrity: expectedIntegrity};
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
