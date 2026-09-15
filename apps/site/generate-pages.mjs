import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { buildPublicPages } from '../../scripts/docs/build-public-docs.mjs';
import {DOC_NAVIGATION, LEGACY_DOC_REDIRECTS, docsArtifactPath} from '../../docs/public-site/routes.mjs';
import {RELEASE_VERSION} from '../../scripts/release/metadata.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const webRoot = resolve(root, '../web');
const playgroundRoot = resolve(root, '../playground');
export const generatedRoot = resolve(root, 'artifacts/site-source');
export const generatedPublic = resolve(root, 'artifacts/site-public');

const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const sitemap = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>\n`;

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
  return `<aside class="docs-sidebar" aria-label="Documentation navigation"><input class="docs-nav-toggle visually-hidden" id="docs-nav-toggle" type="checkbox"><label class="docs-nav-summary" for="docs-nav-toggle">Browse documentation <span aria-hidden="true">⌄</span></label><div class="docs-sidebar-content"><a class="docs-sidebar-brand" href="/"><span>Aeliqo</span><strong>Documentation</strong></a><div class="docs-search-tools"><form class="docs-search-fallback" role="search" aria-label="Search documentation" action="/search/" method="get"><label class="visually-hidden" for="docs-sidebar-search">Search documentation</label><input id="docs-sidebar-search" name="q" type="text" inputmode="search" placeholder="Search docs"><button type="submit">Search</button></form><button class="search-trigger" type="button" disabled aria-keyshortcuts="Control+K Meta+K" aria-controls="docs-search-dialog"><span>Search docs</span><kbd>⌘ K</kbd></button></div><div class="docs-version"><span>Version</span><strong>${RELEASE_VERSION}</strong><i>active</i><a href="/0.1/">0.1 archive</a></div><nav aria-label="Documentation">${links}</nav><a class="docs-sidebar-github" href="https://github.com/Arconath/aeliqo">View source on GitHub <span aria-hidden="true">↗</span></a></div></aside>`;
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
  const headerStart = home.indexOf('<a class="skip"');
  const mainStart = home.indexOf('<main id="main"');
  const footerStart = home.lastIndexOf('<footer');
  const scriptStart = home.indexOf('<script type="module"');
  if (headerStart < 0 || mainStart <= headerStart || footerStart < 0 || scriptStart <= footerStart)
    throw new Error('The landing shell must expose a skip link, main content, footer, and module script in that order.');
  const baseHeader = home.slice(headerStart, mainStart).replace(' aria-current="page"', '');
  const footer = home.slice(footerStart, scriptStart);
  const docs = (await buildPublicPages()).map((page) => ({ ...page, surface: 'docs' }));
  const docsPages = docs.filter((page) => page.component === undefined);
  const all = [...docs];
  const groups = DOC_NAVIGATION;
  const playground = await readFile(join(playgroundRoot, 'playground.html'), 'utf8');
  all.push({
    path: '/playground/',
    title: 'Playground',
    section: 'Playground',
    description: 'Evaluate and present synthetic application data with the real Aeliqo runtime.',
    body: playground,
    surface: 'docs',
  });
  all.push({
    path: '/404/',
    title: 'Page not found',
    section: '404',
    description: 'This page is unavailable.',
    body: '<p>The requested page could not be found.</p><p><a href="https://docs.aeliqo.com/">Browse documentation</a> or <a href="https://aeliqo.com/">return to Aeliqo.</a></p>',
    surface: 'shared',
  });
  const inputs = [join(generatedRoot, 'index.html')];
  for (const page of all) {
    const artifactPath = page.surface === 'docs' && page.path !== '/playground/' ? docsArtifactPath(page.path) : page.path;
    const target = join(generatedRoot, artifactPath, 'index.html');
    await mkdir(dirname(target), { recursive: true });
    const isDocs = page.surface === 'docs' && page.path !== '/playground/';
    const enhanced = isDocs ? enhanceHeadings(page.body) : { html: page.body, headings: [] };
    const articleClass = ['reading', page.path === '/' ? 'docs-home' : '', page.component ? 'component-doc' : '']
      .filter(Boolean)
      .join(' ');
    const body =
      page.path === '/playground/'
        ? page.body
        : `<article class="${articleClass}"><header class="doc-header"><p class="eyebrow">${escape(page.section)}</p><h1>${escape(page.title)}</h1><p class="doc-dek">${escape(page.description)}</p></header>${enhanced.html}</article>`;
    const docsNavigation = isDocs ? docsSidebar(groups, docsPages, page.path) : '';
    const toc = isDocs ? docsToc(enhanced.headings) : '';
    const docsHeader = baseHeader
      .replace('<a href="https://docs.aeliqo.com/">Docs</a>', `<a href="/"${isDocs ? ' aria-current="page"' : ''}>Docs</a>`)
      .replace('<a href="https://docs.aeliqo.com/playground/">Playground</a>', `<a href="/playground/"${page.path === '/playground/' ? ' aria-current="page"' : ''}>Playground</a>`);
    const header = isDocs || page.path === '/playground/'
      ? docsHeader
      : baseHeader.replace('<a class="brand" href="/"', '<a class="brand" href="/" aria-current="page"');
    const layout = isDocs ? 'docs-layout' : page.path === '/playground/' ? 'playground-layout' : 'content-layout';
    const bodyAttrs = [page.component ? `data-component="${page.component}"` : '', isDocs ? 'data-docs="true"' : '']
      .filter(Boolean)
      .join(' ');
    const canonicalOrigin = page.surface === 'docs' ? 'https://docs.aeliqo.com' : 'https://aeliqo.com';
    const canonicalUrl = `${canonicalOrigin}${page.path}`;
    await writeFile(
      target,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} — Aeliqo</title><meta name="description" content="${escape(page.description)}"><link rel="canonical" href="${escape(canonicalUrl)}"><meta property="og:title" content="${escape(page.title)} — Aeliqo"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(canonicalUrl)}"><meta property="og:type" content="website"><link rel="icon" href="/aeliqo.png"><link rel="stylesheet" href="/src/site.css"></head><body${bodyAttrs ? ` ${bodyAttrs}` : ''}>${header}<main id="main" class="shell ${layout}" tabindex="-1">${docsNavigation}${body}${toc}</main>${footer}<script type="module" src="/src/site.ts"></script></body></html>`,
    );
    inputs.push(target);
  }
  await writeFile(
    join(generatedPublic, 'search-index.json'),
    JSON.stringify(docs.map(({ path, title, description, body }) => ({ path, title, description, content: plainText(body) }))),
  );
  await writeFile(join(generatedPublic, 'route-map.json'), JSON.stringify({
    legacyDocs: {...LEGACY_DOC_REDIRECTS, '/docs': '/'},
    canonicalDocs: all.filter((page) => page.surface === 'docs').map((page) => page.path),
  }));
  const docsUrls = all
    .filter((page) => page.surface === 'docs')
    .map((page) => `https://docs.aeliqo.com${page.path}`);
  await writeFile(join(generatedPublic, 'sitemap-main.xml'), sitemap(['https://aeliqo.com/']));
  await writeFile(join(generatedPublic, 'sitemap-docs.xml'), sitemap(docsUrls));
  await writeFile(join(generatedPublic, 'robots-main.txt'), 'User-agent: *\nAllow: /\nSitemap: https://aeliqo.com/sitemap.xml\n');
  await writeFile(join(generatedPublic, 'robots-docs.txt'), 'User-agent: *\nAllow: /\nSitemap: https://docs.aeliqo.com/sitemap.xml\n');
  return inputs;
}
