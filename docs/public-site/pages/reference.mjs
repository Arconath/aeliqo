import { checklist, code, definePage, next, source } from './shared.mjs';
import { RELEASE_VERSION } from '../../../scripts/release/metadata.mjs';

export const referencePages = [
  definePage('reference', {
    title: 'Reference',
    description:
      'Exact package entry points, app lifecycle, intent schema, diagnostics, generated component APIs, and styling hooks.',
    body: `<p class="lead">Use guides to learn the workflow and reference pages to confirm signatures and behavior. Generated declarations supplement authored lifecycle and recovery documentation; they do not replace it.</p>
<h2>Core application surface</h2><div class="doc-table"><table><thead><tr><th>API</th><th>Package</th><th>Purpose</th></tr></thead><tbody><tr><th><code>defineResource</code></th><td><code>@aeliqo/core</code></td><td>Bind runtime schema, identity, semantics, intents, forms, and allowed views.</td></tr><tr><th><code>compileIntent</code></th><td><code>@aeliqo/core</code></td><td>Compile a validated standard or custom intent into Task.</td></tr><tr><th><code>createAeliqoRuntime</code></th><td><code>@aeliqo/runtime/app</code></td><td>Run data, authority, Result, action, and Region lifecycle without DOM.</td></tr><tr><th><code>createAeliqoApp</code></th><td><code>@aeliqo/web/app</code></td><td>Add web renderers and standard adaptive recipes.</td></tr><tr><th><code>defineRecipe</code> / <code>defineView</code></th><td><code>@aeliqo/web/recipes</code></td><td>Register trusted presentation extensions.</td></tr><tr><th><code>createAppToolEndpoint</code></th><td><code>@aeliqo/agent/app</code></td><td>Expose the three standard tools for one paired Region.</td></tr></tbody></table></div>
${next([
  {
    href: '/reference/packages/',
    title: 'Package map',
    description: 'Choose the smallest entry point and understand dependencies.',
  },
  { href: '/reference/app-api/', title: 'App API', description: 'Read method contracts and receipts.' },
  { href: '/components/', title: 'Components', description: 'Browse generated public declarations and live examples.' },
])}`,
  }),

  definePage('packages', {
    title: 'Packages and entry points',
    description:
      'Six version-aligned public packages with explicit browser, server, provider, and framework boundaries.',
    body: `<div class="doc-table"><table><thead><tr><th>Package</th><th>Use for</th><th>Important entry points</th></tr></thead><tbody><tr><th><code>@aeliqo/core</code></th><td>Pure contracts, resources, intent compiler, query planning, semantics, validation.</td><td><code>.</code>, <code>/schema</code></td></tr><tr><th><code>@aeliqo/runtime</code></th><td>Data, evaluation, Results, Regions, actions, persistence, audit.</td><td><code>/app</code>, <code>/data</code>, <code>/actions</code>, <code>/results</code></td></tr><tr><th><code>@aeliqo/web</code></th><td>Web Components, SVG charts, recipes, browser facade, SSR.</td><td><code>/app</code>, <code>/recipes</code>, <code>/server</code>, narrow component subpaths</td></tr><tr><th><code>@aeliqo/react</code></th><td>Thin lifecycle and component wrappers over the web implementation.</td><td><code>/app</code>, family subpaths, <code>/ssr</code></td></tr><tr><th><code>@aeliqo/agent</code></th><td>Three-tool endpoint, MCP, WebMCP, host model adapters.</td><td><code>/app</code>, <code>/mcp</code>, <code>/webmcp</code>, <code>/model</code></td></tr><tr><th><code>@aeliqo/devtools</code></th><td>Authoring and diagnostics library. Studio is not part of the 0.3 product journey.</td><td><code>.</code></td></tr></tbody></table></div>
<h2>Dependency guarantees</h2>${checklist(['Core has no browser, network, provider, or application-state dependency.', 'Runtime does not import DOM or Web Components.', 'Web standalone components remain usable without creating a runtime.', 'React delegates to the web implementation instead of forking behavior.', 'Agent depends on runtime ports and never imports UI implementation.', 'Provider SDKs remain optional peers and browser entries do not pull Node-only code.'])}
<h2>Versioning</h2><p>Install all Aeliqo packages on the same exact release. Package contract versions such as Intent <code>version: "1"</code> are independent from npm version <code>${RELEASE_VERSION}</code>.</p>
${next([
  { href: '/ship/migration-0.1/', title: 'Migrate from 0.1', description: 'Move low-level wiring to the 0.3 facade.' },
  { href: '/ship/ssr/', title: 'SSR entries', description: 'Keep DOM code outside server module evaluation.' },
])}`,
  }),

  definePage('app-api', {
    title: 'Application API',
    description: 'Lifecycle, ownership, defaults, outcomes, and extension definitions for the 0.3 developer path.',
    body: `<h2>createAeliqoApp</h2>${code('Signature', `createAeliqoApp(options: AeliqoAppOptions): AeliqoApp`)}<p><strong>Required:</strong> one or more resource/data bindings and an authority adapter. <strong>Optional:</strong> custom intents, action port, recipes, views, form-state adapter, result store, and resource limits. Standard recipes are included unless a registered preference overrides policy.</p>
<h2>mount</h2>${code('Signature', `app.mount({target, regionId, resourceId}): Outcome<AeliqoRegionElement>`)}<p>Creates one Region and begins container observation. Region IDs are unique within the app. Mount does not fetch data until <code>render</code>.</p>
<h2>render</h2>${code('Signature', `await app.render({regionId, intent, signal?}): Promise<WebRenderReceipt>`)}<p>Parses unknown input, reads current authority, compiles, evaluates, selects a recipe, validates state transfer, commits, and returns a typed receipt. A newer request in the same Region supersedes an older one.</p>
<h2>subscribe and snapshot</h2>${code(
      'Signatures',
      `app.subscribe(regionId, listener): () => void
app.snapshot(regionId): RuntimeRegionState | undefined`,
    )}<p>Subscribers receive sanitized lifecycle state, Result references, and diagnostics—not materialized rows. Subscription is safe before the Region child lifecycle completes.</p>
<h2>unmount and dispose</h2>${code(
      'Signatures',
      `app.unmount(regionId): boolean
app.dispose(): void`,
    )}<p>Unmount cancels and releases one Region. Dispose is idempotent and releases every Region, listener, pending render, Result handle, and owned observer. Calls after disposal fail closed.</p>
<h2>Receipts</h2><p><code>renderer-ready</code>, <code>needs-input</code>, <code>denied</code>, <code>cancelled</code>, <code>unsupported</code>, and <code>failed</code> are distinct. Presentation failures retain the already-committed runtime evidence for inspection while the previous valid UI is restored.</p>
<h2>Source declarations</h2>${source('AeliqoApp types', 'packages/web/src/app/types.ts')}
${next([
  { href: '/reference/intent-schema/', title: 'Intent schema', description: 'Build valid render inputs.' },
  { href: '/reference/diagnostics/', title: 'Diagnostics', description: 'Handle failure and recovery consistently.' },
])}`,
  }),

  definePage('intent-schema', {
    title: 'Intent schema',
    description:
      'Fields, defaults, validation, and examples for browse, detail, create, edit, compare, analyze, and custom intent envelopes.',
    body: `<h2>Shared fields</h2><div class="doc-table"><table><thead><tr><th>Field</th><th>Behavior</th></tr></thead><tbody><tr><th><code>version</code></th><td>Contract version; currently <code>"1"</code>.</td></tr><tr><th><code>id</code></th><td>Bounded request identity used for receipts and supersession.</td></tr><tr><th><code>kind</code></th><td>One standard kind or <code>custom</code>.</td></tr><tr><th><code>resource</code></th><td>Registered resource ID. Unknown values are rejected.</td></tr><tr><th><code>preferredView</code></th><td>Optional preference limited to allowed registered views; omitting it enables default adaptive choice.</td></tr></tbody></table></div>
<h2>Browse</h2>${code(
      'Intent',
      `{
  version: '1', id: 'active-people', kind: 'browse', resource: 'people',
  fields: ['name', 'team'],
  filter: {op: 'compare', field: 'active', comparison: 'eq', value: true},
  sort: [{field: 'name', direction: 'asc'}],
  page: {size: 25},
}`,
    )}
<h2>Detail and compare</h2><p>Identity objects must contain exactly the resource identity fields. Compare accepts bounded identities and fields and preserves simultaneous comparison requirements during presentation.</p>
<h2>Create and edit</h2><p>Create opens the registered creation form. Edit additionally requires exact resource identity; current values and entity revision come from the trusted form-state adapter.</p>
<h2>Analyze</h2><p>Measures must reference registered meanings. Dimensions, filters, period, temporal field, grain, calendar, timezone, sort, and limit are validated against the Catalog and query contract.</p>
<h2>Machine schema</h2>${source('Generated intent JSON Schema', 'packages/core/schemas/intent.schema.json')}
${next([
  {
    href: '/concepts/intent/',
    title: 'Intent concepts',
    description: 'Understand the application and agent boundary.',
  },
  {
    href: '/agents/quickstart/',
    title: 'Send from an agent',
    description: 'Use the exact same schema through <code>aeliqo_render</code>.',
  },
])}`,
  }),

  definePage('diagnostics', {
    title: 'Outcomes and diagnostics',
    description: 'Stable machine codes, bounded human messages, paths, retryability, and recovery behavior.',
    body: `<p class="lead">User-facing recovery follows receipt status first, then diagnostic code. Do not branch application logic on a human message.</p>
<h2>Diagnostic shape</h2>${code(
      'Type',
      `interface Diagnostic {
  code: string;
  message: string;
  path?: readonly (string | number)[];
  retryable: boolean;
  remedies?: readonly string[];
}`,
    )}
<h2>Recovery map</h2><div class="doc-table"><table><thead><tr><th>Status</th><th>UI behavior</th><th>Automatic retry?</th></tr></thead><tbody><tr><th><code>needs-input</code></th><td>Show the bounded choices or missing form field.</td><td>No; wait for user input.</td></tr><tr><th><code>denied</code></th><td>Remove no-longer-authorized data and explain the access boundary.</td><td>No.</td></tr><tr><th><code>cancelled</code></th><td>Usually remain quiet when superseded; preserve current work.</td><td>No.</td></tr><tr><th><code>unsupported</code></th><td>Keep the previous valid UI and show a supported alternative.</td><td>No.</td></tr><tr><th><code>failed</code></th><td>Show an actionable recovery near the affected Region.</td><td>Only when <code>retryable</code> and host policy allow it.</td></tr><tr><th>Ambiguous action</th><td>Show uncertainty and a reconciliation control.</td><td>Never retry blindly.</td></tr></tbody></table></div>
<h2>Privacy</h2><p>Diagnostics and audit events use fixed codes and bounded metadata. Keep credentials, row payloads, prompts, URLs with secrets, free-form identity, and private reasoning out of logs and inspectors.</p>
${next([
  { href: '/agents/recovery/', title: 'Agent recovery', description: 'Apply outcomes to language-driven UI.' },
  { href: '/ship/', title: 'Production acceptance', description: 'Exercise every applicable state before release.' },
])}`,
  }),
];
