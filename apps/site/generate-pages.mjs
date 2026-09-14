import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { buildPublicPages } from '../../scripts/docs/build-public-docs.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const webRoot = resolve(root, '../web');
const playgroundRoot = resolve(root, '../playground');
export const generatedRoot = resolve(root, 'artifacts/site-source');
export const generatedPublic = resolve(root, 'artifacts/site-public');

const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const plainText = (value) =>
  value
    .replace(/<[^>]+>/gu, '')
    .replaceAll('&amp;', 'and')
    .trim();
const slug = (value) =>
  plainText(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/gu, '') || 'section';

function enhanceHeadings(body) {
  const headings = [];
  const used = new Map();
  const html = body.replace(/<h2(?:\s+id="([^"]+)")?>([\s\S]*?)<\/h2>/gu, (_match, existingId, label) => {
    const base = existingId || slug(label);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    headings.push({ id, label: plainText(label) });
    const anchor = label.includes('<a ')
      ? ''
      : `<a class="heading-anchor" href="#${escape(id)}" aria-hidden="true" tabindex="-1">#</a>`;
    return `<h2 id="${escape(id)}">${label}${anchor}</h2>`;
  });
  return { html, headings };
}

function docsSidebar(groups, docsPages, currentPath) {
  const links = groups
    .map(
      ([label, paths]) =>
        `<div class="docs-nav-group"><strong>${label}</strong>${paths
          .map((path) => docsPages.find((page) => page.path === path))
          .filter(Boolean)
          .map(
            (page) =>
              `<a href="${page.path}"${page.path === currentPath ? ' aria-current="page"' : ''}>${escape(page.title)}</a>`,
          )
          .join('')}</div>`,
    )
    .join('');
  return `<aside class="docs-sidebar" aria-label="Documentation navigation"><input class="docs-nav-toggle visually-hidden" id="docs-nav-toggle" type="checkbox"><label class="docs-nav-summary" for="docs-nav-toggle">Browse documentation <span aria-hidden="true">⌄</span></label><div class="docs-sidebar-content"><a class="docs-sidebar-brand" href="/docs/"><span>Aeliqo</span><strong>Documentation</strong></a><div class="docs-search-tools"><form class="docs-search-fallback" role="search" aria-label="Search documentation" action="/docs/search/" method="get"><label class="visually-hidden" for="docs-sidebar-search">Search documentation</label><input id="docs-sidebar-search" name="q" type="text" inputmode="search" placeholder="Search docs"><button type="submit">Search</button></form><button class="search-trigger" type="button" disabled aria-keyshortcuts="Control+K Meta+K" aria-controls="docs-search-dialog"><span>Search docs</span><kbd>⌘ K</kbd></button></div><div class="docs-version"><span>Version</span><strong>0.1.0</strong><i>stable</i></div><nav aria-label="Documentation">${links}</nav><a class="docs-sidebar-github" href="https://github.com/Arconath/aeliqo">View source on GitHub <span aria-hidden="true">↗</span></a></div></aside>`;
}

function docsToc(headings) {
  if (headings.length < 2) return '';
  return `<aside class="docs-toc" aria-label="Table of contents"><strong>On this page</strong><nav aria-label="On this page">${headings.map(({ id, label }) => `<a href="#${escape(id)}">${escape(label)}</a>`).join('')}</nav><a class="docs-toc-top" href="#main">Back to top ↑</a></aside>`;
}

export async function generatePages() {
  await rm(generatedRoot, { recursive: true, force: true });
  await rm(generatedPublic, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });
  await mkdir(generatedPublic, { recursive: true });
  const home = await readFile(join(webRoot, 'index.html'), 'utf8');
  await writeFile(join(generatedRoot, 'index.html'), home);
  await copyFile(join(webRoot, 'public/aeliqo.png'), join(generatedPublic, 'aeliqo.png'));
  const baseHeader = home
    .slice(home.indexOf('<a class="skip"'), home.indexOf('<main id="main">'))
    .replace(' aria-current="page"', '');
  const footer = home.slice(home.lastIndexOf('<footer'), home.indexOf('<script type="module"'));
  const all = (await buildPublicPages()).map((page) => ({ ...page }));
  const docsPages = all.filter((page) => page.path.startsWith('/docs/') && page.component === undefined);
  const groups = [
    [
      'Start',
      [
        '/docs/',
        '/docs/getting-started/',
        '/docs/getting-started/standalone/',
        '/docs/getting-started/local/',
        '/docs/getting-started/http/',
        '/docs/getting-started/region/',
        '/docs/getting-started/agent/',
      ],
    ],
    ['Learn', ['/docs/concepts/', '/docs/meaning/']],
    ['Build', ['/docs/data/', '/docs/integration/', '/docs/agents/']],
    ['Ship', ['/docs/production/']],
    ['Reference', ['/docs/components/', '/docs/search/']],
  ];
  const playground = await readFile(join(playgroundRoot, 'playground.html'), 'utf8');
  all.push({
    path: '/playground/',
    title: 'Playground',
    section: 'Playground',
    description: 'Evaluate and present synthetic application data with the real Aeliqo runtime.',
    body: playground,
  });
  all.push({
    path: '/404/',
    title: 'Page not found',
    section: '404',
    description: 'This page is unavailable.',
    body: '<p>The requested page could not be found.</p><p><a href="/docs/">Browse documentation</a> or <a href="/">return home</a>.</p>',
  });
  const inputs = [join(generatedRoot, 'index.html')];
  for (const page of all) {
    const target = join(generatedRoot, page.path, 'index.html');
    await mkdir(dirname(target), { recursive: true });
    const isDocs = page.path.startsWith('/docs/');
    const enhanced = isDocs ? enhanceHeadings(page.body) : { html: page.body, headings: [] };
    const articleClass = ['reading', page.path === '/docs/' ? 'docs-home' : '', page.component ? 'component-doc' : '']
      .filter(Boolean)
      .join(' ');
    const body =
      page.path === '/playground/'
        ? page.body
        : `<article class="${articleClass}"><header class="doc-header"><p class="eyebrow">${escape(page.section)}</p><h1>${escape(page.title)}</h1><p class="doc-dek">${escape(page.description)}</p></header>${enhanced.html}</article>`;
    const docsNavigation = isDocs ? docsSidebar(groups, docsPages, page.path) : '';
    const toc = isDocs ? docsToc(enhanced.headings) : '';
    const header = baseHeader.replace(
      page.path.startsWith('/docs/')
        ? '<a href="/docs/">Docs</a>'
        : page.path === '/playground/'
          ? '<a href="/playground/">Playground</a>'
          : page.path.startsWith('/blog/')
            ? '<a href="/blog/">Blog</a>'
            : '<a class="brand" href="/"',
      (match) =>
        match.endsWith('>Docs</a>')
          ? '<a href="/docs/" aria-current="page">Docs</a>'
          : match.endsWith('>Playground</a>')
            ? '<a href="/playground/" aria-current="page">Playground</a>'
            : match.endsWith('>Blog</a>')
              ? '<a href="/blog/" aria-current="page">Blog</a>'
              : '<a class="brand" href="/" aria-current="page"',
    );
    const layout = isDocs ? 'docs-layout' : page.path === '/playground/' ? 'playground-layout' : 'content-layout';
    const bodyAttrs = [page.component ? `data-component="${page.component}"` : '', isDocs ? 'data-docs="true"' : '']
      .filter(Boolean)
      .join(' ');
    await writeFile(
      target,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} — Aeliqo</title><meta name="description" content="${escape(page.description)}"><link rel="icon" href="/aeliqo.png"><link rel="stylesheet" href="/src/site.css"></head><body${bodyAttrs ? ` ${bodyAttrs}` : ''}>${header}<main id="main" class="shell ${layout}">${docsNavigation}${body}${toc}</main>${footer}<script type="module" src="/src/site.ts"></script></body></html>`,
    );
    inputs.push(target);
  }
  await writeFile(
    join(generatedPublic, 'search-index.json'),
    JSON.stringify(all.map(({ path, title, description }) => ({ path, title, description }))),
  );
  return inputs;
}
