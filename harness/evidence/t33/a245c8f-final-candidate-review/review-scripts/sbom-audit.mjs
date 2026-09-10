import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';

const [sourceRootArg, candidateDirArg, rebuiltDirArg] = process.argv.slice(2);
if (!sourceRootArg || !candidateDirArg || !rebuiltDirArg) throw new Error('usage: audit SOURCE_ROOT CANDIDATE_DIR REBUILT_DIR');
const sourceRoot = resolve(sourceRootArg);
const candidateDir = resolve(candidateDirArg);
const rebuiltDir = resolve(rebuiltDirArg);
const helpers = await import(`file://${join(sourceRoot, 'scripts/release/candidate-lib.mjs')}`);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = async file => ({bytes: await readFile(file), value: JSON.parse(await readFile(file, 'utf8'))});

const candidate = (await jsonBytes(join(candidateDir, 'manifest.json'))).value;
const sbomRecord = await jsonBytes(join(candidateDir, 'sbom.cdx.json'));
const rebuiltRecord = await jsonBytes(join(rebuiltDir, 'sbom.cdx.json'));
assert(sbomRecord.bytes.equals(rebuiltRecord.bytes), 'fresh offline rebuild SBOM differs byte-for-byte');
const sbom = sbomRecord.value;
assert.equal(sbom.bomFormat, 'CycloneDX');
assert.equal(sbom.specVersion, '1.5');
assert.equal(sbom.version, 1);
assert.equal(sbom.metadata.component.version, candidate.version);
assert(sbom.metadata.component.properties.some(item => item.name === 'aeliqo:source-revision' && item.value === candidate.sourceRevision));

const components = new Map();
for (const component of sbom.components) {
  assert.equal(component['bom-ref'], component.purl);
  assert(!components.has(component['bom-ref']), `duplicate component ${component['bom-ref']}`);
  assert.equal(component.type, 'library');
  assert(component.name && component.version && component.licenses?.length > 0 && component.hashes?.length > 0);
  components.set(component['bom-ref'], component);
}
const dependencyRecords = new Map();
for (const edge of sbom.dependencies) {
  assert(components.has(edge.ref), `unknown dependency ref ${edge.ref}`);
  assert(!dependencyRecords.has(edge.ref), `duplicate dependency record ${edge.ref}`);
  assert.equal(new Set(edge.dependsOn).size, edge.dependsOn.length, `duplicate edge from ${edge.ref}`);
  for (const target of edge.dependsOn) assert(components.has(target), `unknown dependency target ${target}`);
  dependencyRecords.set(edge.ref, edge.dependsOn);
}
assert.equal(dependencyRecords.size, components.size);

const candidateByName = new Map(candidate.packages.map(item => [item.name, item]));
const internal = [];
const external = [];
const workspaceIntegrities = helpers.pnpmLockIntegrities(await readFile(join(sourceRoot, 'pnpm-lock.yaml'), 'utf8'));
for (const component of components.values()) {
  const item = candidateByName.get(component.name);
  if (item) {
    assert.equal(component.version, candidate.version);
    assert.deepEqual(component.licenses, [{license: {id: 'Apache-2.0'}}]);
    assert.deepEqual(component.hashes, [{alg: 'SHA-256', content: item.sha256}]);
    assert(component.properties.some(property => property.name === 'aeliqo:tarball' && property.value === item.file));
    assert(component.properties.some(property => property.name === 'aeliqo:source-revision' && property.value === candidate.sourceRevision));
    internal.push(component['bom-ref']);
  } else {
    const integrity = workspaceIntegrities.get(`${component.name}@${component.version}`);
    assert(integrity, `external ${component.name}@${component.version} absent from frozen lock`);
    assert.deepEqual(component.hashes, [helpers.integrityToCycloneDxHash(integrity)]);
    assert(component.licenses.every(record => typeof record.license?.name === 'string' || typeof record.license?.id === 'string'));
    external.push(component['bom-ref']);
  }
}
assert.equal(internal.length, 6);

const reachable = new Set();
const queue = [...internal];
while (queue.length) {
  const ref = queue.shift();
  if (!ref || reachable.has(ref)) continue;
  reachable.add(ref);
  queue.push(...(dependencyRecords.get(ref) ?? []));
}
assert.equal(reachable.size, components.size, 'SBOM contains components unreachable from the six public packages');

const edgeCount = [...dependencyRecords.values()].reduce((sum, targets) => sum + targets.length, 0);
process.stdout.write(JSON.stringify({
  schema: 'aeliqo.t33.sbom-independent-audit.v1',
  auditedAt: new Date().toISOString(),
  sourceRevision: candidate.sourceRevision,
  candidateVersion: candidate.version,
  sbomSha256: sha256(sbomRecord.bytes),
  freshOfflineRebuildSbomSha256: sha256(rebuiltRecord.bytes),
  byteIdenticalToFreshOfflineRebuild: true,
  format: `${sbom.bomFormat} ${sbom.specVersion}`,
  components: components.size,
  internalComponents: internal.length,
  externalComponents: external.length,
  dependencyRecords: dependencyRecords.size,
  dependencyEdges: edgeCount,
  uniqueBomRefs: true,
  everyDependencyRefAndTargetKnown: true,
  everyComponentReachableFromPublicPackages: true,
  candidateHashesLicensesAndPropertiesExact: true,
  externalHashesLicensesMatchFrozenWorkspaceLock: true,
}, null, 2) + '\n');
