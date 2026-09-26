import { describe, expect, it } from 'vitest';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
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

    const catalog = JSON.parse(await readFile(resolve(repositoryRoot, '../../catalog/components.json'), 'utf8'));
    const ids: string[] = catalog.components.map(({ id }: { id: string }) => id);
    for (const id of ids) {
      const html = await readFile(join(generatedRoot, 'docs/components', id, 'index.html'), 'utf8');
      const navigation = html.match(/<nav aria-label="Documentation">([\s\S]*?)<\/nav>/u)?.[1];
      expect(navigation, `Missing documentation navigation for ${id}`).toBeDefined();
      expect(navigation).toContain('class="docs-component-menu" role="group" aria-label="Component pages"');
      expect(navigation?.match(/<a href="\/components\/[^"/]+\/"/gu)).toHaveLength(ids.length);
      expect(navigation).toContain(`<a href="/components/${id}/" aria-current="page">`);
      for (const catalogId of ids) expect(navigation).toContain(`href="/components/${catalogId}/"`);
    }

    const summaryOrder = (markup: string) =>
      [...markup.matchAll(/<summary>([^<]+)/gu)].map((match) => (match[1] ?? '').trim());
    const pageAt = (route: string) => readFile(join(generatedRoot, 'docs', route, 'index.html'), 'utf8');
    const navOf = async (route: string) =>
      (await pageAt(route)).match(/<nav aria-label="Documentation">([\s\S]*?)<\/nav>/u)?.[1] ?? '';
    const componentNav = await navOf('components/data.table');
    const guideNav = await navOf('guides/resources');
    const startNav = await navOf('start/what-is-aeliqo');
    expect(componentNav).not.toBe('');
    expect(guideNav).not.toBe('');
    expect(startNav).not.toBe('');
    // Sidebar order is identical on every page; only open state and aria-current differ.
    expect(summaryOrder(guideNav)).toEqual(summaryOrder(componentNav));
    expect(summaryOrder(startNav)).toEqual(summaryOrder(componentNav));
    for (const navigation of [componentNav, guideNav, startNav]) {
      expect(navigation.match(/<details class="docs-nav-group"/gu)).toHaveLength(6);
      expect(navigation.match(/<details class="docs-nav-group" open>/gu)).toHaveLength(1);
    }
    const componentDoc = await pageAt('components/data.table');
    expect(componentDoc).toContain('aria-label="Breadcrumb"');
    expect(componentDoc).toContain('<a href="/components/">Components</a>');
    expect(componentDoc).toContain('class="doc-code-copy"');
    const guideDoc = await pageAt('start');
    expect(guideDoc).toContain('aria-label="Breadcrumb"');
    expect(guideDoc).toContain('class="doc-code-copy"');
    expect(guideDoc).toContain('class="tk-kw"');
  });
});
