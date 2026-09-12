import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';

test('authenticated bootstrap preflight preserves clean release source and writes derived evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aeliqo-bootstrap-'));
  const root = resolve(import.meta.dirname, '../..');
  const repo = join(directory, 'repo');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  try {
    await mkdir(join(repo, 'scripts'), { recursive: true });
    await mkdir(join(repo, 'harness'));
    await cp(join(root, 'scripts/release'), join(repo, 'scripts/release'), { recursive: true });
    await cp(join(root, 'harness/release-preflight.json'), join(repo, 'harness/release-preflight.json'));
    await writeFile(join(repo, '.gitignore'), 'artifacts/\n');
    const original = await readFile(join(repo, 'harness/release-preflight.json'), 'utf8');
    git('init', '--quiet');
    git('add', '.');
    git('-c', 'user.name=Aeliqo Test', '-c', 'user.email=test@invalid.example', 'commit', '--quiet', '-m', 'fixture');
    const revision = git('rev-parse', 'HEAD');
    const bin = join(directory, 'bin');
    await mkdir(bin);
    await writeFile(
      join(bin, 'npm'),
      `#!${process.execPath}
const args = process.argv.slice(2).join(' ');
const replies = {
  'whoami --json --registry https://registry.npmjs.org': 'arconath',
  'org ls aeliqo --json --registry https://registry.npmjs.org': {arconath: 'owner'},
  'profile get tfa --json --registry https://registry.npmjs.org': {tfa: {mode: 'auth-and-writes'}},
  'access list packages aeliqo --json --registry https://registry.npmjs.org': {},
};
if (!(args in replies)) process.exit(2);
console.log(JSON.stringify(replies[args]));
`,
      { mode: 0o700 },
    );
    const preload = join(directory, 'registry.mjs');
    await writeFile(
      preload,
      `globalThis.fetch = async (url) => {
  if (!String(url).startsWith('https://registry.npmjs.org/%40aeliqo%2F')) throw new Error('Unexpected registry');
  return new Response(null, {status: 404});
};\n`,
    );
    const result = spawnSync(
      process.execPath,
      ['--import', preload, 'scripts/release/refresh-bootstrap-preflight.mjs'],
      {
        cwd: repo,
        env: { ...process.env, PATH: bin + delimiter + process.env.PATH },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(join(repo, 'harness/release-preflight.json'), 'utf8'), original);
    assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '');
    const evidence = JSON.parse(await readFile(join(repo, 'artifacts/release-bootstrap-preflight.json'), 'utf8'));
    assert.equal(evidence.sourceRevision, revision);
    assert.equal(evidence.namespaceActor, 'arconath');
    assert.equal(evidence.packages.length, 6);
    assert.ok(Date.parse(evidence.postHoldVerifiedAt) <= Date.now());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
