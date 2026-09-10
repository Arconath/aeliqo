import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';

const [sourceRootArg, candidateDirArg, authorRecordArg] = process.argv.slice(2);
if (!sourceRootArg || !candidateDirArg || !authorRecordArg) throw new Error('usage: audit SOURCE_ROOT CANDIDATE_DIR AUTHOR_RECORD');
const sourceRoot = resolve(sourceRootArg);
const candidateDir = resolve(candidateDirArg);
const authorRecordPath = resolve(authorRecordArg);
const helpers = await import(`file://${join(sourceRoot, 'scripts/release/candidate-lib.mjs')}`);
const publication = await import(`file://${join(sourceRoot, 'scripts/release/publication-lib.mjs')}`);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sha512Integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const command = (name, args) => {
  const result = spawnSync(name, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  if (result.status !== 0 || result.error) throw new Error(`${name} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
};
const tarBuffer = (archive, entry) => {
  const result = spawnSync('tar', ['-xOzf', archive, '--', entry], {encoding: null, maxBuffer: 32 * 1024 * 1024});
  if (result.status !== 0 || result.error) throw new Error(`tar extract failed for ${entry}`);
  return result.stdout;
};
const collectTargets = (value, targets = []) => {
  if (typeof value === 'string') targets.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectTargets(item, targets));
  return targets;
};

const candidate = await json(join(candidateDir, 'manifest.json'));
const authorRecord = await json(authorRecordPath);
publication.assertCandidateIdentity(candidate, {bootstrap: true, tag: 'next'});
assert.equal(candidate.schema, 'aeliqo.release-candidate.v1');
assert.equal(candidate.sourceRevision, '763f29a79e93f8808eccdc810b86622837245acf');
assert.equal(candidate.version, '0.1.0-rc.1');
assert.equal(authorRecord.schema, 'aeliqo.t33.final-local-candidate.v1');
assert.equal(authorRecord.source.buildRevision, candidate.sourceRevision);
assert.equal(authorRecord.source.productSourceRevision, 'a245c8f946030f930c9145e44dd7211bcd0fb774');
assert.equal(authorRecord.source.candidateDigest, 'be201bfa2b471c83a3777ed81404d66a7b10a0f4ba97514ef61281d7a67786a8');
assert.equal(authorRecord.candidate.records['manifest.json'], sha256(await readFile(join(candidateDir, 'manifest.json'))));

const canonicalLicense = await readFile(join(sourceRoot, 'LICENSE'));
const canonicalNotice = await readFile(join(sourceRoot, 'NOTICE'));
const positions = new Map(candidate.publishOrder.map((name, index) => [name, index]));
const packages = [];
let totalFiles = 0;
let totalDirectories = 0;
let totalExportSpecifiers = 0;
let totalExportTargets = 0;

for (const item of candidate.packages) {
  const archive = join(candidateDir, item.file);
  const bytes = await readFile(archive);
  assert.equal(bytes.byteLength, item.bytes);
  assert.equal(sha256(bytes), item.sha256);
  assert.equal(sha512Integrity(bytes), item.integrity);
  const paths = command('tar', ['-tzf', archive]).trim().split('\n').filter(Boolean).sort();
  const verbose = command('tar', ['-tzvf', archive]).trim().split('\n').filter(Boolean);
  assert.equal(new Set(paths).size, paths.length, `${item.name} has duplicate archive paths`);
  const entryTypes = verbose.map(line => line[0]);
  assert(entryTypes.every(type => type === '-' || type === 'd'), `${item.name} has non-regular archive entries`);
  const manifest = JSON.parse(tarBuffer(archive, 'package/package.json').toString('utf8'));
  const license = tarBuffer(archive, 'package/LICENSE');
  const notice = tarBuffer(archive, 'package/NOTICE');
  publication.assertCandidateTarball({item, candidateVersion: candidate.version, manifest, paths, license, notice, canonicalLicense, canonicalNotice});

  const files = paths.filter(path => !path.endsWith('/'));
  const directories = paths.filter(path => path.endsWith('/'));
  const unexpectedPaths = files.filter(path => !['package/package.json', 'package/README.md', 'package/LICENSE', 'package/NOTICE'].includes(path)
    && !path.startsWith('package/dist/') && !path.startsWith('package/schemas/'));
  const unsafePaths = paths.filter(path => !path.startsWith('package/') || path.includes('..') || path.includes('\\'));
  const sensitivePaths = files.filter(path => /(?:^|[._-])(?:env|npmrc|pypirc|netrc|credentials?|secrets?|id_rsa|id_ed25519)(?:$|[._-])/i.test(path.slice('package/'.length)));
  assert.deepEqual(unexpectedPaths, []);
  assert.deepEqual(unsafePaths, []);
  assert.deepEqual(sensitivePaths, []);

  const internalDependencies = [];
  let workspaceProtocols = 0;
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      if (String(version).startsWith('workspace:')) workspaceProtocols += 1;
      if (!positions.has(name)) continue;
      assert.equal(version, candidate.version, `${item.name} has non-exact ${field} edge ${name}`);
      assert(positions.get(name) < positions.get(item.name), `${item.name} is ordered before ${name}`);
      internalDependencies.push({field, name, version});
    }
  }
  assert.equal(workspaceProtocols, 0);
  const targets = collectTargets(manifest.exports);
  const specifiers = helpers.exportSpecifiers(manifest, paths);
  totalFiles += files.length;
  totalDirectories += directories.length;
  totalExportTargets += targets.length;
  totalExportSpecifiers += specifiers.length;
  packages.push({
    name: item.name,
    version: manifest.version,
    file: item.file,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    integrity: sha512Integrity(bytes),
    license: manifest.license,
    private: manifest.private === true,
    fileEntries: files.length,
    directoryEntries: directories.length,
    regularOrDirectoryEntriesOnly: true,
    duplicatePaths: 0,
    unsafePaths: 0,
    unexpectedPaths: 0,
    sensitivePaths: 0,
    workspaceProtocols: 0,
    internalDependencies,
    exportTargets: targets.length,
    exportSpecifiers: specifiers.length,
    canonicalLicenseSha256: sha256(license),
    canonicalNoticeSha256: sha256(notice),
  });
}

helpers.assertPublishOrder(packages.map((item, index) => ({name: item.name, manifest: JSON.parse(tarBuffer(join(candidateDir, item.file), 'package/package.json').toString('utf8')), index})));
assert.deepEqual(authorRecord.candidate.packages, candidate.packages.map(({version: _version, ...item}) => item));

process.stdout.write(JSON.stringify({
  schema: 'aeliqo.t33.tarball-independent-audit.v1',
  auditedAt: new Date().toISOString(),
  sourceRevision: candidate.sourceRevision,
  version: candidate.version,
  publishOrder: candidate.publishOrder,
  packageCount: packages.length,
  totalFiles,
  totalDirectories,
  totalExportTargets,
  totalExportSpecifiers,
  authorRecordSha256: sha256(await readFile(authorRecordPath)),
  candidateManifestSha256: sha256(await readFile(join(candidateDir, 'manifest.json'))),
  canonicalLicenseSha256: sha256(canonicalLicense),
  canonicalNoticeSha256: sha256(canonicalNotice),
  packages,
}, null, 2) + '\n');
