import {afterEach, describe, expect, it} from 'vitest';
import {appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const verifier = resolve(repositoryRoot, 'scripts/verify-inputs.mjs');
const temporaryRoots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'aeliqo-site-inputs-'));
  temporaryRoots.push(root);
  cpSync(resolve(repositoryRoot, 'vendor'), resolve(root, 'vendor'), {recursive: true});
  cpSync(resolve(repositoryRoot, '../docs/vendor'), resolve(root, 'docs/vendor'), {recursive: true});
  cpSync(resolve(repositoryRoot, 'package.json'), resolve(root, 'package.json'));
  cpSync(resolve(repositoryRoot, 'pnpm-workspace.yaml'), resolve(root, 'pnpm-workspace.yaml'));
  return root;
}

function verify(root: string) {
  const environment = {...process.env};
  if (root !== repositoryRoot) environment.AELIQO_VERIFY_ROOT = root;
  else delete environment.AELIQO_VERIFY_ROOT;
  return spawnSync(process.execPath, [verifier], {
    cwd: repositoryRoot,
    env: environment,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, {recursive: true, force: true});
});

describe('vendored build input verification', () => {
  it('accepts the exact source-bound SDK and documentation set', () => {
    const result = verify(repositoryRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({sdkVersion: '0.1.0-rc.2', packages: 6, exports: 130, docsPages: 93, secretFindings: 0});
  });

  it('rejects modified candidate package bytes', () => {
    const root = fixture();
    const manifest = JSON.parse(readFileSync(resolve(root, 'vendor/packages/manifest.json'), 'utf8')) as {packages: {file: string}[]};
    appendFileSync(resolve(root, 'vendor/packages', manifest.packages[0]!.file), 'tampered');
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('integrity check failed');
  });

  it.each(['vendor/packages/consumer.json', 'docs/vendor/public-docs/manifest.json'])('rejects symlinked vendored input %s', (path) => {
    const root = fixture();
    const target = resolve(root, path);
    const bytes = readFileSync(target);
    rmSync(target);
    const outside = resolve(root, 'consumer-outside.json');
    writeFileSync(outside, bytes);
    symlinkSync(outside, target);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('may not be a symlink');
  });

  it('rejects a site version that differs from the candidate', () => {
    const root = fixture();
    const path = resolve(root, 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {version: string};
    manifest.version = '0.1.0-rc.3';
    writeFileSync(path, `${JSON.stringify(manifest)}\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('versions differ');
  });

  it('rejects a missing documentation manifest', () => {
    const root = fixture();
    rmSync(resolve(root, 'docs/vendor/public-docs/manifest.json'));
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ENOENT');
  });

  it('rejects an unsupported documentation schema', () => {
    const root = fixture();
    const path = resolve(root, 'docs/vendor/public-docs/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {schema: string};
    manifest.schema = 'aeliqo.public-docs-manifest.invalid';
    writeFileSync(path, `${JSON.stringify(manifest)}\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unsupported public docs manifest schema');
  });

  it('rejects documentation produced from a modified source tree', () => {
    const root = fixture();
    const path = resolve(root, 'docs/vendor/public-docs/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {sourceTree: string};
    manifest.sourceTree = 'modified';
    writeFileSync(path, `${JSON.stringify(manifest)}\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must come from a clean source tree');
  });

  it('rejects a documentation checksum inventory that differs from the manifest', () => {
    const root = fixture();
    appendFileSync(resolve(root, 'docs/vendor/public-docs/SHA256SUMS'), `${'0'.repeat(64)}  unexpected.ts\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('checksum inventory differs');
  });

  it('rejects an SBOM entry that differs from the candidate package evidence', () => {
    const root = fixture();
    const path = resolve(root, 'vendor/packages/sbom.cdx.json');
    const sbom = JSON.parse(readFileSync(path, 'utf8')) as {components: {name: string; hashes: {alg: string; content: string}[]}[]};
    const component = sbom.components.find(item => item.name === '@aeliqo/core');
    if (component === undefined) throw new Error('Missing test SBOM component.');
    const digest = component.hashes.find(item => item.alg === 'SHA-256');
    if (digest === undefined) throw new Error('Missing test SBOM digest.');
    digest.content = '0'.repeat(64);
    writeFileSync(path, `${JSON.stringify(sbom)}\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SBOM entry differs from @aeliqo/core');
  });

  it('rejects duplicate documentation routes even when the outer checksum matches', () => {
    const root = fixture();
    const manifestPath = resolve(root, 'docs/vendor/public-docs/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {artifact: {file: string; bytes: number; sha256: string}};
    const artifactPath = resolve(root, 'docs/vendor/public-docs', manifest.artifact.file);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {pages: unknown[]};
    artifact.pages.push(artifact.pages[0]);
    const bytes = Buffer.from(JSON.stringify(artifact));
    writeFileSync(artifactPath, bytes);
    manifest.artifact.bytes = bytes.byteLength;
    manifest.artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('routes are invalid');
  });
});
