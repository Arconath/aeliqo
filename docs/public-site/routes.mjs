const route = (id, path, group, sourcePath) => Object.freeze({id, path, group, ...(sourcePath === undefined ? {} : {sourcePath})});

export const DOC_ROUTES = Object.freeze([
  route('home', '/', 'Start', '/docs/'),
  route('what-is', '/start/what-is-aeliqo/', 'Start'),
  route('quickstart', '/start/', 'Start', '/docs/getting-started/'),
  route('existing-app', '/start/existing-app/', 'Start'),
  route('standalone', '/start/standalone-components/', 'Start', '/docs/getting-started/standalone/'),
  route('frameworks', '/start/frameworks/', 'Start', '/docs/integration/'),

  route('resources', '/guides/resources/', 'Build'),
  route('data', '/guides/data/', 'Build', '/docs/data/'),
  route('local-data', '/guides/local-data/', 'Build', '/docs/getting-started/local/'),
  route('http-data', '/guides/http-data/', 'Build', '/docs/getting-started/http/'),
  route('permissions', '/guides/permissions/', 'Build'),
  route('actions', '/guides/actions/', 'Build'),
  route('forms', '/guides/forms/', 'Build'),
  route('navigation', '/guides/navigation/', 'Build'),
  route('responsive', '/guides/responsive-behavior/', 'Build'),
  route('adaptive-region', '/guides/adaptive-region/', 'Build', '/docs/getting-started/region/'),
  route('custom-views', '/guides/custom-views/', 'Build'),

  route('agents', '/agents/', 'Connect agents', '/docs/agents/'),
  route('agents-quickstart', '/agents/quickstart/', 'Connect agents', '/docs/getting-started/agent/'),
  route('mcp', '/agents/mcp/', 'Connect agents'),
  route('webmcp', '/agents/webmcp/', 'Connect agents'),
  route('byok', '/agents/byok/', 'Connect agents'),
  route('agent-recovery', '/agents/recovery/', 'Connect agents'),

  route('concepts', '/concepts/', 'Understand', '/docs/concepts/'),
  route('intent', '/concepts/intent/', 'Understand'),
  route('semantics', '/concepts/semantics/', 'Understand', '/docs/meaning/'),
  route('state-ownership', '/concepts/state-ownership/', 'Understand'),
  route('safety', '/concepts/safety/', 'Understand'),

  route('components', '/components/', 'Components & recipes', '/docs/components/'),
  route('reference', '/reference/', 'Reference'),
  route('packages', '/reference/packages/', 'Reference'),
  route('app-api', '/reference/app-api/', 'Reference'),
  route('intent-schema', '/reference/intent-schema/', 'Reference'),
  route('diagnostics', '/reference/diagnostics/', 'Reference'),
  route('search', '/search/', 'Reference', '/docs/search/'),

  route('ship', '/ship/', 'Ship', '/docs/production/'),
  route('ssr', '/ship/ssr/', 'Ship'),
  route('browser-support', '/ship/browser-support/', 'Ship'),
  route('migration', '/ship/migration-0.1/', 'Ship'),
  route('release-notes', '/ship/release-notes/', 'Ship'),
  route('archive-0.1', '/0.1/', 'Archive'),

  route('examples', '/examples/', 'Examples'),
  route('people-example', '/examples/people/', 'Examples'),
  route('products-example', '/examples/products/', 'Examples'),
  route('support-example', '/examples/support/', 'Examples'),
  route('knowledge-example', '/examples/knowledge/', 'Examples'),

  route('about', '/about/', 'About'),
  route('license', '/legal/license/', 'About'),
  route('privacy', '/legal/privacy/', 'About'),
  route('security', '/legal/security/', 'About'),
  route('support', '/legal/support/', 'About'),
]);

const bySource = new Map(DOC_ROUTES.filter((item) => item.sourcePath !== undefined).map((item) => [item.sourcePath, item]));
const byPath = new Map(DOC_ROUTES.map((item) => [item.path, item]));

export function routeById(id) {
  const value = DOC_ROUTES.find((item) => item.id === id);
  if (value === undefined) throw new Error(`Unknown documentation route ${id}.`);
  return value;
}

export function canonicalDocsPath(path) {
  const exact = bySource.get(path);
  if (exact !== undefined) return exact.path;
  if (path.startsWith('/docs/components/')) return `/components/${path.slice('/docs/components/'.length)}`;
  if (path.startsWith('/docs/')) return undefined;
  return path;
}

export function sourceDocsPath(path) {
  const exact = byPath.get(path);
  if (exact?.sourcePath !== undefined) return exact.sourcePath;
  if (path.startsWith('/components/')) return `/docs/components/${path.slice('/components/'.length)}`;
  return undefined;
}

export function docsArtifactPath(path) {
  if (path === '/') return '/docs/';
  if (!path.startsWith('/')) throw new TypeError('A documentation path must be absolute.');
  return `/docs${path}`;
}

export function canonicalizeDocsMarkup(markup) {
  return markup.replaceAll(/href="(\/docs\/[^"#?]*)([?#][^"]*)?"/gu, (_match, source, suffix = '') => {
    const canonical = canonicalDocsPath(source);
    if (canonical === undefined) throw new Error(`Documentation content links to an unmapped route: ${source}`);
    return `href="${canonical}${suffix}"`;
  });
}

const navigation = [
  ['Start', ['home', 'what-is', 'quickstart', 'existing-app', 'standalone', 'frameworks']],
  ['Build', ['resources', 'data', 'local-data', 'http-data', 'permissions', 'actions', 'forms', 'navigation', 'responsive', 'adaptive-region', 'custom-views']],
  ['Connect agents', ['agents', 'agents-quickstart', 'mcp', 'webmcp', 'byok', 'agent-recovery']],
  ['Understand', ['concepts', 'intent', 'semantics', 'state-ownership', 'safety']],
  ['Components & recipes', ['components']],
  ['Reference', ['reference', 'packages', 'app-api', 'intent-schema', 'diagnostics', 'search']],
  ['Ship', ['ship', 'ssr', 'browser-support', 'migration', 'release-notes']],
  ['Examples', ['examples', 'people-example', 'products-example', 'support-example', 'knowledge-example']],
];

export const DOC_NAVIGATION = Object.freeze(navigation.map(([label, ids]) => Object.freeze([
  label,
  Object.freeze(ids.map((id) => routeById(id).path)),
])));

export const LEGACY_DOC_REDIRECTS = Object.freeze(Object.fromEntries(
  DOC_ROUTES.filter((item) => item.sourcePath !== undefined && item.sourcePath !== item.path)
    .map((item) => [item.sourcePath, item.path]),
));
