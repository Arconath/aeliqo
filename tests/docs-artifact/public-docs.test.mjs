import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { DOC_ROUTES } from '../../docs/public-site/routes.mjs';
import { readVerifiedPublicDocs, sha256 } from '../../scripts/docs/public-docs-contract.mjs';
import { RELEASE_VERSION } from '../../scripts/release/metadata.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, `artifacts/public-docs/${RELEASE_VERSION}/manifest.json`);
const rcVersion = `${RELEASE_VERSION}-rc.2`;
const execFileAsync = promisify(execFile);

test('public docs artifact binds exact source, packages, API metadata, and runnable examples', async () => {
  const { artifact, manifest } = await readVerifiedPublicDocs(manifestPath);
  assert.equal(artifact.docsVersion, RELEASE_VERSION);
  assert.match(artifact.source.revision, /^[a-f0-9]{40}$/u);
  assert.equal(artifact.pages.length, DOC_ROUTES.length + 71);
  assert.equal(new Set(artifact.pages.map((page) => page.id)).size, artifact.pages.length);
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
  for (const scenario of ['people', 'products', 'support', 'knowledge']) {
    const page = artifact.pages.find((candidate) => candidate.path === `/docs/examples/${scenario}/`);
    assert.ok(page, `Missing ${scenario} example page`);
    assert.equal((page.body.match(/data-project-scenario=/gu) ?? []).length, 6);
    assert.match(page.body, /src\/main\.ts · compiled export source/u);
    assert.match(page.body, /createAeliqoApp/u);
  }
  const migration = artifact.pages.find((page) => page.path === '/docs/ship/migration-0.1/');
  assert.ok(migration, 'Missing migration page');
  assert.match(migration.body, /examples\/migration-0\.1\/before\.ts/u);
  assert.match(migration.body, /examples\/quickstart\/src\/app\.ts/u);
  const sums = await readFile(resolve(root, `artifacts/public-docs/${RELEASE_VERSION}/SHA256SUMS`), 'utf8');
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
  assert.equal(artifact.pages.length, DOC_ROUTES.length + 71);
  assert.equal(manifest.packageVersions['@aeliqo/web'], RELEASE_VERSION);
  assert.equal(JSON.stringify(manifest).includes('packages/web/src'), true);
});

test('verification rejects changed bytes, path traversal, and forged package identity', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-test-'));
  await cp(resolve(root, `artifacts/public-docs/${RELEASE_VERSION}`), scratch, { recursive: true });
  const copiedManifest = join(scratch, 'manifest.json');
  const manifest = JSON.parse(await readFile(copiedManifest, 'utf8'));
  const artifactPath = join(scratch, manifest.artifact.file);
  await writeFile(artifactPath, `${await readFile(artifactPath, 'utf8')} `);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /checksum|byte length/u);

  manifest.artifact.file = '../escape.json';
  await writeFile(copiedManifest, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(readVerifiedPublicDocs(copiedManifest), /local file name/u);

  await cp(resolve(root, `artifacts/public-docs/${RELEASE_VERSION}`), scratch, { recursive: true, force: true });
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
  await cp(resolve(root, `artifacts/public-docs/${RELEASE_VERSION}`), scratch, { recursive: true });
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
    ['scripts/docs/build-public-docs.mjs', '--output', scratch, '--source-revision', revision, '--version', rcVersion],
    { cwd: root },
  );
  const { artifact, manifest } = await readVerifiedPublicDocs(join(scratch, `${rcVersion}/manifest.json`));
  assert.equal(artifact.docsVersion, rcVersion);
  assert.equal(artifact.source.revision, revision);
  assert.ok(Object.values(artifact.packageVersions).every((version) => version === rcVersion));
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
        rcVersion,
      ],
      { cwd: root },
    ),
    /source revision must identify a commit/u,
  );
});

test('producer rejects an existing repository commit that is not checked-out HEAD', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-stale-revision-'));
  const { stdout: tree } = await execFileAsync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root });
  const { stdout } = await execFileAsync('git', ['commit-tree', tree.trim(), '-m', 'stale docs producer test'], {
    cwd: root,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Aeliqo test',
      GIT_AUTHOR_EMAIL: 'test@aeliqo.invalid',
      GIT_COMMITTER_NAME: 'Aeliqo test',
      GIT_COMMITTER_EMAIL: 'test@aeliqo.invalid',
    },
  });
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
        rcVersion,
      ],
      { cwd: root },
    ),
    /source revision must match the checked-out HEAD/u,
  );
});

test('verification rejects a catalog symlink that escapes the artifact directory', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'aeliqo-public-docs-symlink-test-'));
  await cp(resolve(root, `artifacts/public-docs/${RELEASE_VERSION}`), scratch, { recursive: true });
  const outside = join(scratch, '..', `aeliqo-outside-${process.pid}.ts`);
  const indexPath = join(scratch, 'catalog-examples/index.ts');
  await writeFile(outside, await readFile(indexPath));
  await rm(indexPath);
  await symlink(outside, indexPath);
  await assert.rejects(readVerifiedPublicDocs(join(scratch, 'manifest.json')), /escapes/u);
  await rm(outside);
});
