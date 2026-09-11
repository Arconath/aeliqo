import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { readVerifiedPublicDocs, sha256 } from '../../scripts/docs/public-docs-contract.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, 'artifacts/public-docs/0.1.0/manifest.json');
const execFileAsync = promisify(execFile);

test('public docs artifact binds exact source, packages, API metadata, and runnable examples', async () => {
  const { artifact, manifest } = await readVerifiedPublicDocs(manifestPath);
  assert.equal(artifact.docsVersion, '0.1.0');
  assert.match(artifact.source.revision, /^[a-f0-9]{40}$/u);
  assert.equal(artifact.pages.length, 93);
  assert.equal(artifact.pages.filter((page) => page.component !== undefined).length, 71);
  assert.ok(artifact.pages.every((page) => page.body.length > 0));
  assert.match(
    artifact.pages.find((page) => page.path === '/docs/components/foundation.button/').body,
    /export declare class AeliqoButtonElement/u,
  );
  assert.match(
    artifact.pages.find((page) => page.path === '/docs/components/foundation.button/').body,
    /data-example-code="button"/u,
  );
  const sums = await readFile(resolve(root, 'artifacts/public-docs/0.1.0/SHA256SUMS'), 'utf8');
  assert.equal(
    sums,
    [
      `${manifest.artifact.sha256}  ${manifest.artifact.file}`,
      ...manifest.catalogFiles.map((file) => `${file.sha256}  ${file.path}`),
    ].join('\n') + '\n',
  );
  assert.ok(manifest.catalogFiles.length > 10);
  assert.ok(
    manifest.inputs.some((input) => input.path.startsWith('packages/web/dist/') && input.path.endsWith('.d.ts')),
  );
});

test('an external consumer can accept the verified public artifact without private site source', async () => {
  const { artifact, manifest } = await readVerifiedPublicDocs(manifestPath);
  assert.equal(artifact.pages.length, 93);
  assert.equal(manifest.packageVersions['@aeliqo/web'], '0.1.0');
  assert.equal(JSON.stringify(manifest).includes('packages/web/src'), true);
});

test('verification rejects changed bytes, path traversal, and forged package identity', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-test-'));
  await cp(resolve(root, 'artifacts/public-docs/0.1.0'), scratch, { recursive: true });
  const copiedManifest = join(scratch, 'manifest.json');
  const manifest = JSON.parse(await readFile(copiedManifest, 'utf8'));
  const artifactPath = join(scratch, manifest.artifact.file);
  await writeFile(artifactPath, `${await readFile(artifactPath, 'utf8')} `);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /checksum|byte length/u);

  manifest.artifact.file = '../escape.json';
  await writeFile(copiedManifest, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /local file name/u);

  await cp(resolve(root, 'artifacts/public-docs/0.1.0'), scratch, { recursive: true, force: true });
  const forgedManifest = JSON.parse(await readFile(copiedManifest, 'utf8'));
  const forgedArtifactPath = join(scratch, forgedManifest.artifact.file);
  const forgedArtifact = JSON.parse(await readFile(forgedArtifactPath, 'utf8'));
  forgedArtifact.packageVersions['@aeliqo/web'] = '9.9.9';
  const forgedBytes = Buffer.from(`${JSON.stringify(forgedArtifact, null, 2)}\n`);
  forgedManifest.artifact.sha256 = sha256(forgedBytes);
  forgedManifest.artifact.bytes = forgedBytes.byteLength;
  await writeFile(forgedArtifactPath, forgedBytes);
  await writeFile(copiedManifest, `${JSON.stringify(forgedManifest, null, 2)}\n`);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /packageVersions/u);
});

test('verification rejects a changed executable catalog example', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-example-test-'));
  await cp(resolve(root, 'artifacts/public-docs/0.1.0'), scratch, { recursive: true });
  const copiedManifest = join(scratch, 'manifest.json');
  const indexPath = join(scratch, 'catalog-examples/index.ts');
  await writeFile(indexPath, `${await readFile(indexPath, 'utf8')} `);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /catalog example integrity/u);
});

test('producer can bind the docs artifact to one exact release-candidate package set', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-rc-test-'));
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
  const revision = stdout.trim();
  await execFileAsync(
    process.execPath,
    [
      'scripts/docs/build-public-docs.mjs',
      '--output',
      scratch,
      '--source-revision',
      revision,
      '--version',
      '0.1.0-rc.2',
    ],
    { cwd: root },
  );
  const { artifact, manifest } = await readVerifiedPublicDocs(join(scratch, '0.1.0-rc.2/manifest.json'));
  assert.equal(artifact.docsVersion, '0.1.0-rc.2');
  assert.equal(artifact.source.revision, revision);
  assert.ok(Object.values(artifact.packageVersions).every((version) => version === '0.1.0-rc.2'));
  assert.deepEqual(artifact.packageVersions, manifest.packageVersions);
});

test('producer rejects a shaped source revision that is not a repository commit', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-forged-revision-'));
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        'scripts/docs/build-public-docs.mjs',
        '--output',
        scratch,
        '--source-revision',
        'a'.repeat(40),
        '--version',
        '0.1.0-rc.2',
      ],
      { cwd: root },
    ),
    /source revision must identify a commit/u,
  );
});

test('producer rejects an existing repository commit that is not checked-out HEAD', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-stale-revision-'));
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD^'], { cwd: root });
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        'scripts/docs/build-public-docs.mjs',
        '--output',
        scratch,
        '--source-revision',
        stdout.trim(),
        '--version',
        '0.1.0-rc.2',
      ],
      { cwd: root },
    ),
    /source revision must match the checked-out HEAD/u,
  );
});

test('verification rejects a catalog symlink that escapes the artifact directory', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-symlink-test-'));
  await cp(resolve(root, 'artifacts/public-docs/0.1.0'), scratch, { recursive: true });
  const outside = join(scratch, '..', `aeliqo-outside-${process.pid}.ts`);
  const indexPath = join(scratch, 'catalog-examples/index.ts');
  await writeFile(outside, await readFile(indexPath));
  await rm(indexPath);
  await symlink(outside, indexPath);
  await assert.rejects(readVerifiedPublicDocs(join(scratch, 'manifest.json')), /escapes/u);
  await rm(outside);
});
