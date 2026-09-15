import { describe, expect, it } from 'vitest';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const generatedRoot = resolve(repositoryRoot, 'artifacts/site-source');
const generatedPublic = resolve(repositoryRoot, 'artifacts/site-public');

describe('static page generation', () => {
  it('removes stale generated source and public files before regeneration', async () => {
    const staleSource = join(generatedRoot, 'removed-route/index.html');
    const stalePublic = join(generatedPublic, 'removed-public-input.json');
    await mkdir(join(generatedRoot, 'removed-route'), { recursive: true });
    await mkdir(generatedPublic, { recursive: true });
    await writeFile(staleSource, 'stale route');
    await writeFile(stalePublic, 'stale public input');

    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        'const {generatePages}=await import("./generate-pages.mjs"); await generatePages();',
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stderr).toBe(0);

    await expect(access(staleSource)).rejects.toThrow();
    await expect(access(stalePublic)).rejects.toThrow();
  });
});
