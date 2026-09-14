const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const code = (label, source) =>
  `<figure class="doc-code"><figcaption>${escape(label)}</figcaption><pre tabindex="0"><code>${escape(source)}</code></pre></figure>`;

const note = (title, body, tone = 'note') =>
  `<aside class="doc-callout" data-tone="${tone}"><strong>${title}</strong><p>${body}</p></aside>`;

const next = (items) =>
  `<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p>${items.map(({ href, title, description }) => `<a href="${href}"><span>${title}</span><small>${description}</small><b aria-hidden="true">→</b></a>`).join('')}</nav>`;

const install = code(
  'Terminal',
  'npm install --save-exact \\\n  @aeliqo/core@0.1.0 \\\n  @aeliqo/runtime@0.1.0 \\\n  @aeliqo/web@0.1.0',
);

export const pages = [
  {
    path: '/docs/',
    title: 'Build an interface with evidence attached',
    section: 'Documentation',
    description:
      'Start with an Aeliqo component, then add typed data, semantics, adaptive regions, or optional agents only when the task needs them.',
    body: `
<section class="docs-landing-hero">
  <div><p class="lead">Aeliqo is an open-source TypeScript framework for building interfaces from application-owned data and intent. Use one web component directly, or connect the runtime when your interface needs typed queries, traceable results, and validated adaptation.</p><div class="docs-landing-actions"><a class="primary" href="/docs/getting-started/">Start the quickstart <span aria-hidden="true">→</span></a><a href="/playground/">Explore the playground</a></div></div>
  <dl class="docs-facts"><div><dt>71</dt><dd>owned UI components</dd></div><div><dt>6</dt><dd>version-aligned packages</dd></div><div><dt>0</dt><dd>required model calls</dd></div></dl>
</section>
${install}
${note('Keep the host in control', 'Your application continues to own authentication, authorization, source access, routes, and business execution. Aeliqo validates the contracts passed across those boundaries.', 'boundary')}
<h2>See one path end to end</h2>
<section class="docs-proof" aria-label="Example task to result flow">
  <header><div><span class="status-pulse" aria-hidden="true"></span><strong>Synthetic local example</strong></div><span>No provider · no network</span></header>
  <div class="docs-proof-grid">
    <div><span class="doc-card-index">INPUT · TASK</span><p>Compare absence days by team for active people.</p><code>output: absence_by_team</code><code>grain: team</code></div>
    <span aria-hidden="true">→</span>
    <div><span class="doc-card-index">OUTPUT · RESULT</span><strong>Engineering · 11 days</strong><p>Exact · 2 active people · revision 1</p><small>Scope and lineage stay attached.</small></div>
  </div>
  <a href="/playground/">Run the complete guided journey <span aria-hidden="true">→</span></a>
</section>
<h2>Choose the smallest useful path</h2>
<div class="doc-paths doc-paths-featured">
  <a href="/docs/getting-started/standalone/"><span class="doc-card-index">01</span><h3>Render one component</h3><p>Bring application-owned rows and handle native events. No evaluator or agent is involved.</p><strong>Standalone component →</strong></a>
  <a href="/docs/getting-started/local/"><span class="doc-card-index">02</span><h3>Evaluate local records</h3><p>Run bounded canonical queries over an in-memory snapshot and keep result evidence attached.</p><strong>Local runtime →</strong></a>
  <a href="/docs/getting-started/http/"><span class="doc-card-index">03</span><h3>Connect a server source</h3><p>Keep credentials and authenticated execution in your application service through the ADC HTTP contract.</p><strong>HTTP service →</strong></a>
  <a href="/docs/getting-started/region/"><span class="doc-card-index">04</span><h3>Compose a smart region</h3><p>Present named outputs through a plan checked against scope, semantics, accessibility, and host grants.</p><strong>Smart region →</strong></a>
  <a href="/docs/getting-started/agent/"><span class="doc-card-index">05</span><h3>Add an optional agent</h3><p>Route MCP or a host-supplied model through the same typed, bounded dispatcher used by manual tools.</p><strong>Agent boundary →</strong></a>
  <a href="/docs/components/"><span class="doc-card-index">71</span><h3>Browse the component catalog</h3><p>Open runnable examples, source-derived properties, events, states, accessibility hooks, and public declarations.</p><strong>Component reference →</strong></a>
</div>
<h2>Understand the system</h2>
<ol class="concept-flow"><li><span>01</span><div><h3>Catalog</h3><p>Describes entities, fields, identity, relationships, meanings, and source capabilities.</p></div></li><li><span>02</span><div><h3>Task</h3><p>Names the outputs and operations the user needs, including dependencies and delivery.</p></div></li><li><span>03</span><div><h3>Result</h3><p>Carries rows together with revision, scope, grain, completeness, precision, and lineage.</p></div></li><li><span>04</span><div><h3>Experience</h3><p>Constrains the presentation so adaptation preserves meaning, access, and essential operations.</p></div></li></ol>
<h2>Package map</h2>
<div class="doc-table"><table><thead><tr><th>Package</th><th>Use it for</th><th>Typical client</th></tr></thead><tbody><tr><th><code>@aeliqo/web</code></th><td>Web components, Regions, 2D data views, and SSR</td><td>Browser or server renderer</td></tr><tr><th><code>@aeliqo/react</code></th><td>Thin React bindings over the same web implementation</td><td>React application</td></tr><tr><th><code>@aeliqo/core</code></th><td>Catalog, Task, query, presentation, and validation contracts</td><td>Shared application code</td></tr><tr><th><code>@aeliqo/runtime</code></th><td>Local/HTTP data services, evaluation, results, interactions, and audit export</td><td>Browser or application service</td></tr><tr><th><code>@aeliqo/agent</code></th><td>MCP and bounded host-model adapters</td><td>Trusted host process</td></tr><tr><th><code>@aeliqo/devtools</code></th><td>Local authoring and inspection sessions</td><td>Developer tooling</td></tr></tbody></table></div>
${next([
  {
    href: '/docs/getting-started/',
    title: 'Quickstart',
    description: 'Install, render, and verify the first component.',
  },
  { href: '/docs/concepts/', title: 'Core concepts', description: 'Learn the contracts before composing a Region.' },
  {
    href: '/docs/integration/',
    title: 'Framework integration',
    description: 'Connect vanilla, React, Vue, SSR, and hydration surfaces.',
  },
  {
    href: '/docs/production/',
    title: 'Production guide',
    description: 'Ship with explicit security and lifecycle boundaries.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/',
    title: 'Quickstart',
    section: 'Start',
    description: 'Install Aeliqo 0.1.0, render a real record list, and choose the next integration boundary.',
    body: `
<p class="lead">The fastest useful integration is one component with application-owned data. This guide gets that path running, explains the contract you are adopting, and shows when to introduce the runtime.</p>
${note('Prerequisites', 'Use Node.js 24 and keep every Aeliqo package on the same exact version. The examples use ESM and browser custom elements.')}
<h2>1. Install the package set</h2><p>For a basic browser integration, install core, runtime, and web together. Add React, agent, or devtools only when the application actually uses those boundaries.</p>${install}
<h2>2. Add a record list</h2><p>Import the narrow component entry, register its element name once, and assign structured data as JavaScript properties. Stable identity lets selection survive sorting and filtering.</p>
${code(
  'app.ts',
  `import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}

const list = document.querySelector('aeliqo-record-list');
list.columns = [
  {key: 'name', label: 'Name'},
  {key: 'team', label: 'Team'},
];
list.identity = ['id'];
list.rows = [
  {id: 'ada', name: 'Ada Chen', team: 'Design'},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering'},
];
list.scope = {label: 'Active people', kind: 'filtered', loaded: 2, filteredTotal: 2};`,
)}
${code('index.html', `<aeliqo-record-list aria-label="Active people"></aeliqo-record-list>`)}
<h2>3. Handle interaction in the host</h2><p>Aeliqo emits typed events; your application decides what they mean. Keep navigation, writes, authorization checks, and business side effects in host code. Never infer authority from a selected row or a proposal payload.</p>
${code(
  'selection.ts',
  `list.addEventListener('aeliqo-record-list-selection', (event) => {
  const {keys} = event.detail;
  const selectedIds = keys.filter((key) => permittedIds.has(key));
  renderSelection(selectedIds);
});`,
)}
<div class="doc-checklist"><h3>First integration check</h3><ul><li>The list has a useful accessible name and visible scope.</li><li>Row identity remains stable after filtering or sorting.</li><li>Loading, empty, partial, stale, error, and ready states are exercised.</li><li>Keyboard and narrow-screen use preserve every essential operation.</li><li>Your application rechecks authorization before any side effect.</li></ul></div>
<h2>4. Choose what comes next</h2><div class="decision-grid"><article><h3>You already have the rows</h3><p>Stay with standalone components. This keeps the dependency and authority surface smallest.</p><a href="/docs/getting-started/standalone/">Standalone guide →</a></article><article><h3>You need typed local queries</h3><p>Add the runtime over a bounded snapshot supplied by the application.</p><a href="/docs/getting-started/local/">Local records guide →</a></article><article><h3>Data must remain on the server</h3><p>Expose a bounded application-owned ADC endpoint and inject the authenticated principal there.</p><a href="/docs/getting-started/http/">HTTP guide →</a></article><article><h3>The layout should adapt</h3><p>Use a Region after you have validated Tasks and Results with explicit scope and meaning.</p><a href="/docs/getting-started/region/">Region guide →</a></article></div>
${next([
  { href: '/docs/integration/', title: 'Framework integration', description: 'Vanilla, React, Vue, and SSR recipes.' },
  {
    href: '/docs/components/',
    title: 'Component catalog',
    description: 'Find properties, events, states, and examples.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/standalone/',
    title: 'Standalone components',
    section: 'Start / Standalone',
    description: 'Render Aeliqo elements with host-owned data, properties, and native events without an evaluator.',
    body: `
<p class="lead">Use a standalone component when your application already owns the records and interaction model. It is the default path for forms, navigation, feedback, tables, cards, and charts.</p>
<h2>What this path includes</h2><div class="ownership-grid"><article><span>Aeliqo owns</span><ul><li>Rendering and component states</li><li>Keyboard and focus behavior</li><li>Typed public properties and events</li><li>Shared theme tokens and shadow parts</li></ul></article><article><span>Your application owns</span><ul><li>Authentication and authorization</li><li>Fetching and filtering permitted data</li><li>Routes and business actions</li><li>Error recovery and product policy</li></ul></article></div>
<h2>Import narrowly</h2><p>Component entry points let bundlers include the surface you use. Guard registration when multiple application modules may import the same element.</p>${code(
      'table.ts',
      `import {AeliqoTableElement} from '@aeliqo/web/table';

if (!customElements.get('aeliqo-table')) {
  customElements.define('aeliqo-table', AeliqoTableElement);
}`,
    )}
<h2>Pass objects as properties</h2><p>Use JavaScript properties for rows, columns, scope, Results, and presentation structures. HTML attributes remain appropriate for strings, booleans, names, labels, and other scalar configuration documented by the component.</p>
<h2>Listen at the boundary</h2><p>Events report user intent or component state. Treat event detail as input: validate it, map stable identity to an authorized host record, and perform any side effect through the application’s normal command path.</p>
<h2>Theme the composition</h2><p>Set the documented theme tokens on a host ancestor and use public shadow parts only where the component reference exposes them. Avoid selectors that depend on internal shadow markup.</p>
<h2>Verify the complete state model</h2><p>Test ready content and the states that change a user decision: loading, empty, partial, stale, denied, unsupported, and error. When data is wider than the viewport, retain keyboard access and a visible or programmatic description of scrolling.</p>
${next([
  {
    href: '/docs/components/',
    title: 'Component catalog',
    description: 'Inspect the exact API and runnable example for every element.',
  },
  {
    href: '/docs/getting-started/local/',
    title: 'Add local evaluation',
    description: 'Turn bounded records into traceable Results.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/local/',
    title: 'Evaluate local records',
    section: 'Start / Local runtime',
    description:
      'Use the reusable local data service for bounded application-owned snapshots without a network or model provider.',
    body: `
<p class="lead">The local runtime evaluates canonical queries over records your application already loaded and is allowed to expose. It is useful for offline tools, embedded analysis, tests, and deterministic demonstrations.</p>
${note('Use a bounded snapshot', 'The local service is not a browser database mirror. Set source and query budgets that fit the device, clear materialized data when access changes, and move server-only data behind the HTTP boundary.', 'boundary')}
<h2>Prepare the source contract</h2><p>A local source combines a Catalog, stable snapshot revision, records, a function registry, source capabilities, and explicit limits. The Catalog describes what can be requested; the supplied snapshot determines what can be evaluated now.</p>
<h2>Create the service</h2>${code(
      'data-service.ts',
      `import {createLocalDataService, DEFAULT_SOURCE_LIMITS} from '@aeliqo/runtime/data';

const service = createLocalDataService({
  snapshot,
  functionRegistry,
  sourceLimits: {...DEFAULT_SOURCE_LIMITS, maxRows: 5_000},
});`,
    )}
<h2>Plan, execute, and retain evidence</h2><ol class="doc-steps"><li><span>1</span><div><h3>Describe</h3><p>Expose entity identity, field types, relationships, meanings, and supported operations through the Catalog.</p></div></li><li><span>2</span><div><h3>Plan</h3><p>Validate a canonical query against capabilities, meaning, grain, and budget before touching rows.</p></div></li><li><span>3</span><div><h3>Execute</h3><p>Produce a bounded Result with exact revision and scope identity. Unsupported work returns a typed outcome.</p></div></li><li><span>4</span><div><h3>Present</h3><p>Bind the Result to a component or validated Region without broadening its claim.</p></div></li></ol>
<h2>Handle lifecycle changes</h2><p>Cancel outstanding work when the view changes or access is withdrawn. Do not reuse a Result after its source revision, scope digest, or governing grant becomes stale. Materialized row handles should be released when the result is no longer authorized or needed.</p>
<h2>Choose local or HTTP</h2><div class="doc-table"><table><thead><tr><th>Constraint</th><th>Local service</th><th>HTTP service</th></tr></thead><tbody><tr><th>Where rows exist</th><td>Already permitted in the client</td><td>Remain in the application service</td></tr><tr><th>Credentials</th><td>None in the evaluator</td><td>Held by the server</td></tr><tr><th>Offline use</th><td>Supported by the host snapshot</td><td>Requires service reachability</td></tr><tr><th>Scale</th><td>Bounded client workload</td><td>Bounded server execution</td></tr></tbody></table></div>
${next([
  {
    href: '/docs/data/',
    title: 'Data contracts',
    description: 'Read the complete source, Result, streaming, and cancellation model.',
  },
  {
    href: '/docs/getting-started/http/',
    title: 'HTTP application service',
    description: 'Keep source execution and credentials on the server.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/http/',
    title: 'Connect an HTTP application service',
    section: 'Start / HTTP runtime',
    description:
      'Expose bounded ADC discovery and execution while identity, credentials, and source policy remain on the server.',
    body: `
<p class="lead">Use the HTTP path when source records or credentials must stay on the server. The application service owns authentication and injects the effective principal and policy before it delegates to Aeliqo’s handler.</p>
<h2>Place the trust boundary</h2><div class="boundary-diagram" role="img" aria-label="Browser sends a typed request to the application service, which authenticates it and executes against a private source"><div>Browser UI<small>Task + cancellation</small></div><span aria-hidden="true">→</span><div>Application service<small>Identity + source policy</small></div><span aria-hidden="true">→</span><div>Private source<small>Authorized execution</small></div></div>
${note('Never trust wire identity', 'A principal identifier or policy-shaped field sent by the browser is data, not authority. Derive both from the authenticated server request.', 'warning')}
<h2>Expose the ADC handler</h2><p>The reference host composes <code>createDataHttpHandler</code> with an application-owned service. Mount it behind route authentication, constrain origins and request size at the edge, and attach policy before execution.</p>${code(
      'server.mjs',
      `import {createDataHttpHandler, createLocalDataService} from '@aeliqo/runtime/data';

const data = createLocalDataService({snapshot, functionRegistry, sourceLimits});
const handleData = createDataHttpHandler({
  service: data,
  authenticate: async (request) => {
    const principal = await authenticateRequest(request);
    return principal
      ? {ok: true, value: {principal}}
      : {ok: false, diagnostics: [{
          code: 'data.authorization',
          message: 'Authentication required.',
          retryable: false,
        }]};
  },
});

export const post = (request) => handleData(request);`,
    )}
<h2>Create the client service</h2><p>The client uses the same DataService boundary as the local implementation, so evaluation and presentation code remain transport-independent.</p>${code(
      'client.ts',
      `import {createHttpDataService} from '@aeliqo/runtime/data';

const data = createHttpDataService({
  baseUrl: '/api/aeliqo',
  fetch: window.fetch.bind(window),
});`,
    )}
<h2>Reject invalid sequences</h2><p>Fail closed on malformed messages, unknown outputs, repeated completion, data after completion, stale revisions, unsupported operations, or requests crossing row, byte, time, column, or message budgets. Preserve partial completeness when a stream ends early.</p>
<h2>Make cancellation real</h2><p>Propagate the client abort signal through the handler to the source driver. Closing a browser request without stopping database or upstream work is not cancellation.</p>
<h2>Deployment checklist</h2><div class="doc-checklist"><ul><li>Authentication runs before discovery and execution.</li><li>Source policy is derived on the server for every request.</li><li>Credentials never enter the browser bundle, URL, export, or Result.</li><li>Request, response, query, and materialization limits are explicit.</li><li>Cancellation reaches the active source operation.</li><li>Revocation clears cached or materialized rows.</li></ul></div>
${next([
  {
    href: '/docs/data/',
    title: 'Data contracts',
    description: 'Inspect discovery, Results, updates, and typed failure outcomes.',
  },
  {
    href: '/docs/getting-started/region/',
    title: 'Present a Region',
    description: 'Turn validated named outputs into an adaptive interface.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/region/',
    title: 'Compose a smart Region',
    section: 'Start / Region',
    description:
      'Render named task outputs through a validated presentation plan that preserves semantics and host authority.',
    body: `
<p class="lead">A Region is the adaptive composition boundary. Give it evaluated Results and a validated presentation; it renders owned components while preserving required outputs, identity, scope, and interactions.</p>
<h2>Use a Region when composition matters</h2><p>A single table does not need a Region. Introduce one when a task has multiple named outputs, the layout may adapt to its environment, or interactions must connect one result to another without losing traceability.</p>
<h2>Keep three graphs separate</h2><div class="decision-grid"><article><h3>Output dependencies</h3><p>Which query or reused Result must exist before another output can be evaluated.</p></article><article><h3>Visual containment</h3><p>Which presentation nodes contain other nodes in the rendered interface.</p></article><article><h3>Interaction links</h3><p>Which typed selection or filter event may update another node or request more data.</p></article></div>
<h2>Prepare the Region state</h2>${code(
      'region.ts',
      `import {AeliqoRegionElement} from '@aeliqo/web/region';

if (!customElements.get('aeliqo-region')) {
  customElements.define('aeliqo-region', AeliqoRegionElement);
}

const region = document.querySelector('aeliqo-region');
region.presentation = validatedPresentation;
region.results = evaluatedResults;
region.interaction = currentInteractionState;`,
    )}
<h2>Validate before commit</h2><ol class="doc-steps"><li><span>1</span><div><h3>Check coverage</h3><p>Every required Task output and operation must have a compatible presentation node.</p></div></li><li><span>2</span><div><h3>Check evidence</h3><p>Claims must be supported by the bound Result’s scope, grain, precision, and completeness.</p></div></li><li><span>3</span><div><h3>Check current state</h3><p>Commit against current Catalog, Experience, function registry, Result revisions, and grants.</p></div></li><li><span>4</span><div><h3>Render atomically</h3><p>If validation fails, preserve the last authorized interface or clear it after revocation.</p></div></li></ol>
<h2>Adapt without changing the task</h2><p>A Region can choose a supported layout or view for space, input mode, density, locale, direction, and user preferences. It cannot drop an essential comparison, hide a required action, broaden scope, or reinterpret a measure.</p>
<h2>Handle interaction</h2><p>Selection and filters carry stable identity and the Result reference that established their scope. The host validates the request and controls any new evaluation. Visible row position is never identity.</p>
${next([
  {
    href: '/docs/concepts/',
    title: 'Core concepts',
    description: 'Understand Catalog, Task, Result, and Experience in depth.',
  },
  {
    href: '/docs/production/',
    title: 'Production guide',
    description: 'Verify authorization, accessibility, SSR, and lifecycle handling.',
  },
])}`,
  },
  {
    path: '/docs/getting-started/agent/',
    title: 'Add an optional agent',
    section: 'Start / Agent',
    description:
      'Connect MCP or a host-supplied model through bounded capabilities while manual interaction stays complete.',
    body: `
<p class="lead">An agent can propose a Task, meaning, or presentation, but it never becomes the application’s authority. Use the same typed dispatcher for manual, MCP, and model-originated requests.</p>
${note('Manual remains complete', 'Clicks, typing, filtering, resizing, local evaluation, and authored Tasks do not require a model. The interface must remain usable when every agent provider is unavailable.', 'boundary')}
<h2>Decide whether an agent belongs</h2><div class="doc-table"><table><thead><tr><th>Need</th><th>Recommended path</th></tr></thead><tbody><tr><th>Known component and data</th><td>Write the integration directly.</td></tr><tr><th>Local developer authoring</th><td>Use devtools with reviewed definitions.</td></tr><tr><th>External tool protocol</th><td>Expose a narrow MCP capability set.</td></tr><tr><th>Natural-language assistance</th><td>Use the bounded model loop with a host provider.</td></tr></tbody></table></div>
<h2>Grant capabilities, not broad access</h2><p>Keep read, evaluate, define meaning, activate meaning, present, perform business action, and model egress as distinct grants. Project only currently allowed tools and recheck permission at execution time.</p>
<h2>Contain every proposal</h2><p>A parsed proposal may still use the wrong business definition. Preserve explicit outcomes such as <code>bound</code>, <code>needs-choice</code>, <code>needs-meaning</code>, <code>unsupported</code>, <code>denied</code>, <code>invalid</code>, and <code>stale</code>.</p>
<h2>Keep secrets server-side</h2><p>Provider implementations belong in a trusted host process. Store credentials there, disclose model egress, enforce time and tool budgets, and never export credentials, raw sensitive rows, or private reasoning into browser state.</p>
<h2>Design the fallback first</h2><p>Verify that the current authorized interface survives provider errors, cancellation, invalid output, exhausted budgets, and rejected proposals. Bound retries by progress.</p>
<div class="doc-checklist"><h3>Agent acceptance</h3><ul><li>The tool list contains only current, relevant capabilities.</li><li>Every effect passes through the host dispatcher.</li><li>Provider egress and credential ownership are explicit.</li><li>Cancellation and finite retry budgets are tested.</li><li>Model text is treated as a proposal, not evidence.</li><li>A complete manual route remains available.</li></ul></div>
${next([
  {
    href: '/docs/agents/',
    title: 'Protocols and adapters',
    description: 'MCP, BYOK, WebMCP, dispatch, and failure behavior.',
  },
  {
    href: '/playground/',
    title: 'Playground',
    description: 'Exercise manual and local-runtime paths without a provider.',
  },
])}`,
  },
  {
    path: '/docs/concepts/',
    title: 'Core concepts',
    section: 'Learn',
    description:
      'Understand how Catalog, Task, Result, and Experience separate intent, execution, evidence, and presentation.',
    body: `
<p class="lead">Aeliqo uses four public concepts so a flexible interface can change shape without changing what the application knows, what the user asked, or what the data supports.</p>
<h2>Catalog describes what exists</h2><p>A Catalog declares entities, stable identity, typed fields, relationships, meanings, source capabilities, and version references. It is descriptive. Discovering a field does not authorize reading it.</p>
<h2>Task describes what is needed</h2><p>A Task names outputs, the operation behind each output, dependencies, delivery timing, and task-level requirements. Outputs may have different grains. A presentation-only or form task may be queryless.</p>${code(
      'Task shape',
      `const task = {
  id: 'absence-overview',
  needs: ['compare teams', 'inspect a person'],
  outputs: [
    {id: 'ranking', kind: 'query', dependsOn: [], delivery: 'eager'},
    {id: 'detail', kind: 'query', dependsOn: ['ranking'], delivery: 'on-demand'},
  ],
};`,
    )}
<h2>Result carries the evidence</h2><p>A Result identifies the exact evaluated output. Its reference binds revision, query digest, scope digest, and output identity. Descriptors preserve grain, completeness, precision, consistency, source observations, and lineage.</p>
<h2>Experience constrains presentation</h2><p>Experience captures presentation preferences and requirements alongside accessibility, environment, and product constraints. It can guide density, layout, or compatible view choice. It cannot override authorization.</p>
<h2>The commit read-set joins them</h2><p>A presentation commit records the Catalog, Region, Experience, function registry, and Result revisions it read. If one changes before commit, validation returns a stale outcome.</p>
<h2>Identity, scope, and grain</h2><div class="definition-list"><div><dt>Identity</dt><dd>The stable key for an entity. Selection uses identity, never visible row position.</dd></div><div><dt>Scope</dt><dd>The authorized population represented by a Result, expressed through a digest and user-facing label.</dd></div><div><dt>Grain</dt><dd>What one row represents, such as one employee per week or one order line.</dd></div><div><dt>Lineage</dt><dd>Which prior Results contributed to a derived output.</dd></div></div>
${note('A useful invariant', 'Presentation may reduce visual complexity, but it must not broaden scope, hide incomplete data, merge incompatible units, or imply a grain the Result does not contain.', 'boundary')}
${next([
  {
    href: '/docs/meaning/',
    title: 'Data and meaning',
    description: 'Define business measures, units, grain, and ownership.',
  },
  {
    href: '/docs/getting-started/region/',
    title: 'Smart Region',
    description: 'Apply these concepts in an adaptive composition.',
  },
])}`,
  },
  {
    path: '/docs/meaning/',
    title: 'Data and meaning',
    section: 'Learn',
    description:
      'Define business meaning once so developer code, local authoring, and optional agents use the same typed graph.',
    body: `
<p class="lead">A typed query can still answer the wrong business question. Meaning definitions make measures, inputs, units, grain, null behavior, temporal policy, and ownership reviewable before evaluation.</p>
<h2>Begin with the entity model</h2><p>Declare stable entity identity and typed fields before defining measures. Relationships must state direction and fanout because a join can change grain and double-count records even when every field type is correct.</p>
<h2>Build with registered functions</h2><p>The meaning builder refers to fields and versioned functions instead of embedding unreviewed executable code. Unknown fields, incompatible types, and invalid inputs produce diagnostics at authoring time.</p>
<h2>Make business choices explicit</h2><div class="definition-list"><div><dt>Aggregation</dt><dd>Count rows, distinct entities, sum a value, or compute a rate with a stated denominator.</dd></div><div><dt>Units</dt><dd>Keep currency, duration, percentage, and plain counts distinct.</dd></div><div><dt>Null and zero</dt><dd>Decide whether missing data is excluded, propagated, imputed, or displayed as unknown.</dd></div><div><dt>Time</dt><dd>State timezone, calendar, grain, interval bounds, and fixed or live cohort behavior.</dd></div></div>
<h2>Preserve ownership</h2><p>Reviewed definitions shipped in code remain code-owned. Local devtools can create user-owned drafts. An optional agent may propose a draft, but it cannot silently replace an active definition.</p>
<h2>Separate definition from activation</h2><p>A shape-valid draft is not active meaning. The trusted host decides whether the current principal may activate it, rechecks the proposal read-set, and records the accepted immutable revision.</p>
<h2>Review a measure before use</h2><div class="doc-checklist"><ul><li>The entity identity and row grain are correct.</li><li>Relationship fanout cannot duplicate the measure.</li><li>Units and numeric precision are compatible.</li><li>Null, zero, and missing-period behavior are stated.</li><li>Fixed and live cohort semantics match the question.</li><li>Ownership and activation authority are explicit.</li></ul></div>
${next([
  {
    href: '/docs/data/',
    title: 'Connect application data',
    description: 'Carry meaning into bounded source capabilities and Results.',
  },
  { href: '/docs/agents/', title: 'Agent proposals', description: 'Contain AI-authored meaning behind host approval.' },
])}`,
  },
  {
    path: '/docs/data/',
    title: 'Data services and Results',
    section: 'Build',
    description:
      'Connect bounded local or HTTP data services and preserve scope, revision, completeness, and cancellation.',
    body: `
<p class="lead">Aeliqo separates describing a source, planning a query, executing it, and presenting the Result. The separation keeps capability, authorization, and evidence visible at every step.</p>
<h2>The DataService boundary</h2><p>Both local and HTTP implementations satisfy the same contract. A consumer discovers a Catalog and limits, asks for a supported canonical query, receives bounded result messages, and may cancel work.</p>
<h2>Source capabilities are descriptive</h2><p>Capabilities state which filters, projections, grouping, ordering, functions, and limits a source can execute. They help the planner reject unsupported work early. The host supplies current authorization separately.</p>
<h2>Results are more than rows</h2><div class="doc-table"><table><thead><tr><th>Result field</th><th>Why it matters</th></tr></thead><tbody><tr><th>Reference</th><td>Binds output, query, revision, and scope identity.</td></tr><tr><th>Grain</th><td>States what a row represents and which identity fields preserve selection.</td></tr><tr><th>Completeness</th><td>Distinguishes complete, partial, sampled, or truncated data.</td></tr><tr><th>Precision</th><td>Prevents approximate values from being presented as exact.</td></tr><tr><th>Lineage</th><td>Links derived outputs to the Results they read.</td></tr><tr><th>Handle</th><td>Materializes rows under runtime ownership and lifecycle controls.</td></tr></tbody></table></div>
<h2>Streaming has a strict lifecycle</h2><p>A valid stream establishes metadata before batches, emits bounded data in order, and reaches one terminal outcome. Consumers reject unknown outputs, duplicate terminal messages, data after completion, or changed Result identity.</p>
<h2>Cancellation must release work</h2><p>Cancellation stops the active plan, source request, stream, and downstream materialization. When authority changes, clear retained rows even if a visual surface could continue rendering them.</p>
<h2>Return typed failures</h2><p>Use unsupported when the source lacks an operation, denied when policy prevents it, invalid for malformed structures, stale for changed revisions, and needs-meaning when a measure is undefined.</p>
<h2>Export bounded audit events</h2><p>The local audit exporter accepts fixed event shapes and rejects free-form messages, records, prompts, credentials, URLs, and identity fields. The host owns storage, transport, retention, and access.</p>
${next([
  {
    href: '/docs/getting-started/local/',
    title: 'Local service',
    description: 'Evaluate a bounded application-owned snapshot.',
  },
  {
    href: '/docs/getting-started/http/',
    title: 'HTTP service',
    description: 'Keep private source execution on the server.',
  },
])}`,
  },
  {
    path: '/docs/integration/',
    title: 'Framework integration',
    section: 'Build',
    description:
      'Use the same Aeliqo web implementation from vanilla JavaScript, React, Vue, or server-rendered applications.',
    body: `
<p class="lead">Aeliqo’s browser implementation is a standards-based custom-element layer. Framework bindings stay thin so properties, events, accessibility behavior, and theming do not diverge by application stack.</p>
<h2>Vanilla JavaScript</h2><p>Import a narrow entry, register it once, then assign structured values as properties.</p>${code(
      'app.ts',
      `import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

customElements.define('aeliqo-record-list', AeliqoRecordListElement);
const list = document.querySelector('aeliqo-record-list');
list.rows = people;
list.columns = [{key: 'name', label: 'Name'}];
list.identity = ['id'];`,
    )}
<h2>React</h2><p>Use the React package for typed JSX props and callbacks. It renders the same underlying custom element, so the component reference remains the behavior source.</p>${code(
      'People.tsx',
      `import {AeliqoRecordList} from '@aeliqo/react/data';

export function People({people, onSelect}) {
  return <AeliqoRecordList
    rows={people}
    columns={[{key: 'name', label: 'Name'}]}
    identity={['id']}
    onSelectionChange={(event) => onSelect(event.detail.keys)}
  />;
}`,
    )}
<h2>Vue</h2><p>Configure Vue’s compiler to treat <code>aeliqo-*</code> as custom elements. Bind objects with properties and handle the native event name.</p>${code(
      'vite.config.ts',
      `vue({
  template: {compilerOptions: {isCustomElement: (tag) => tag.startsWith('aeliqo-')}},
})`,
    )}${code(
      'People.vue',
      `<aeliqo-record-list
  :rows="people"
  :columns="columns"
  :identity="['id']"
  @selection-change="handleSelection"
/>`,
    )}
<h2>Server rendering</h2><p><code>@aeliqo/web/server</code> produces declarative shadow roots. Send initial state as separately escaped JSON, load hydration, and verify forms, focus restoration, event ownership, and failure behavior in the final framework.</p>
<h2>Integration rules that stay constant</h2><div class="doc-checklist"><ul><li>Use properties for arrays and structured values.</li><li>Register each custom-element name once.</li><li>Keep all Aeliqo packages on one exact version.</li><li>Handle native events at the application boundary.</li><li>Test SSR and hydration in the actual host framework.</li><li>Use public tokens and parts instead of internal shadow selectors.</li></ul></div>
${next([
  {
    href: '/docs/components/',
    title: 'Component reference',
    description: 'Find exact import paths, properties, states, and events.',
  },
  { href: '/docs/production/', title: 'Production guide', description: 'Validate the final application composition.' },
])}`,
  },
  {
    path: '/docs/agents/',
    title: 'Agents and protocols',
    section: 'Build',
    description:
      'Use MCP, host-supplied model adapters, or experimental WebMCP through one bounded capability dispatcher.',
    body: `
<p class="lead">Agent support is an adapter layer around typed Aeliqo capabilities. The protocol can change; host authority checks, Task validation, Result evidence, and presentation commit rules stay the same.</p>
<h2>One dispatcher, several origins</h2><p>Manual tools, MCP calls, model tool calls, and experimental browser tools enter the same dispatcher with an explicit origin and current grants. An adapter never acquires a broader path than the product UI.</p>
<h2>MCP</h2><p>The agent package supports tested stdio and HTTP flows using the official SDK. Expose a narrow tool inventory, validate arguments, attach current principal context in the host, and propagate cancellation.</p>
<h2>Bring your own model</h2><p>The bounded loop accepts a host provider and projects approved tools. The OpenAI adapter is a server-side entry. The host owns credentials, egress disclosure, budgets, model selection, observability, and retention policy.</p>
<h2>Experimental WebMCP</h2><p>The browser adapter detects whether the native surface exists. Availability varies by browser and release channel. Treat native and simulated behavior as experimental and preserve an ordinary DOM path.</p>
<h2>Validate the outcome, not the prose</h2><p>Parse the proposal, bind references to the current Catalog, validate meaning and Task requirements, evaluate through a permitted source, inspect evidence, and commit only against a current read-set.</p>
<h2>Bound the loop</h2><div class="doc-checklist"><ul><li>Limit turns, tool calls, elapsed time, payload size, and retries.</li><li>Stop on repeated failure without new information.</li><li>Cancel provider and tool work together.</li><li>Keep unsupported and denied outcomes distinct.</li><li>Exclude credentials, sensitive rows, and private reasoning from audit export.</li><li>Preserve a complete provider-free interface.</li></ul></div>
${next([
  {
    href: '/docs/getting-started/agent/',
    title: 'Agent boundary',
    description: 'Decide when and how to add assistance.',
  },
  {
    href: '/docs/production/',
    title: 'Production guide',
    description: 'Review egress, authority, lifecycle, and operations.',
  },
])}`,
  },
  {
    path: '/docs/production/',
    title: 'Production guide',
    section: 'Ship',
    description:
      'Review package compatibility, security, accessibility, SSR, lifecycle, diagnostics, and release checks before shipping.',
    body: `
<p class="lead">Production readiness belongs to the final application composition. Use this checklist after the chosen components, source path, Task, Results, and presentation have been integrated in the real host.</p>
<h2>Pin one release line</h2><p>Keep all Aeliqo packages on the same exact version. Aeliqo 0.1.0 is a rewrite and is not an automatic upgrade from historical package APIs; follow the repository migration guide.</p>
<h2>Protect authority boundaries</h2><div class="doc-checklist"><ul><li>Identity comes from authenticated host context.</li><li>Read, evaluate, activate meaning, present, act, and model-egress grants are distinct.</li><li>Wire payloads and agent proposals never establish authority.</li><li>Source and business credentials stay outside browser bundles and exports.</li><li>Async work rechecks scope before commit or side effect.</li><li>Revocation clears unauthorized materialized data.</li></ul></div>
<h2>Test accessible use</h2><p>Test the complete application with keyboard, zoom, reflow, forced colors, reduced motion, and the screen-reader/browser pairs your users rely on. Automated checks do not prove that task wording, focus order, announcements, or chart alternatives work for a person.</p>
<h2>Verify every data state</h2><p>Exercise loading, ready, empty, partial, sampled, stale, denied, unsupported, invalid, canceled, and failed outcomes. Keep scope, units, time policy, precision, and completeness visible where they could change a decision.</p>
<h2>Bound resource use</h2><p>Prefer narrow imports, defer optional agent and inspector code, and set row, byte, column, message, and elapsed-time limits. Measure the shipped application on representative devices and data.</p>
<h2>Verify SSR and hydration</h2><p>Check declarative shadow roots, escaped initial state, focus, native form behavior, element registration, and a readable fallback when hydration fails.</p>
<h2>Observe without collecting payloads</h2><p>Use fixed diagnostic codes and numeric resource observations. Keep records, prompts, credentials, URLs, free-form user text, and direct identity out of Aeliqo audit events.</p>
<h2>Troubleshoot by outcome</h2><div class="doc-table"><table><thead><tr><th>Outcome</th><th>Check first</th></tr></thead><tbody><tr><th><code>stale</code></th><td>Refresh the exact Catalog, Result, scope, or presentation revision.</td></tr><tr><th><code>unsupported</code></th><td>Compare the query with advertised source capabilities.</td></tr><tr><th><code>needs-meaning</code></th><td>Select or define the intended versioned business measure.</td></tr><tr><th><code>denied</code></th><td>Keep the safe interface and inspect the current host grant.</td></tr><tr><th>Hydration mismatch</th><td>Compare server and client package versions, state, and registration order.</td></tr></tbody></table></div>
<h2>Release acceptance</h2><div class="doc-checklist"><ul><li>Exact package versions and source revision are recorded.</li><li>Focused unit, browser, accessibility, and host checks pass.</li><li>No credentials or private server logic enter the public bundle.</li><li>Required licenses and notices ship.</li><li>Manual fallbacks work without a provider.</li><li>Known limits appear beside the affected journey.</li></ul></div>
${next([
  { href: '/docs/components/', title: 'Component reference', description: 'Review exact APIs and state behavior.' },
  {
    href: '/legal/security/',
    title: 'Report a vulnerability',
    description: 'Use the project’s private reporting path.',
  },
])}`,
  },
  {
    path: '/about/',
    title: 'About Aeliqo',
    section: 'Aeliqo',
    description: 'An open-source framework for semantic, adaptive user interfaces.',
    body: `<p class="lead">Aeliqo connects application-owned data and intent to interfaces that keep scope, grain, and lineage visible.</p><h2>What the framework owns</h2><p>Aeliqo provides UI primitives and 2D views, typed semantic and query contracts, bounded runtime services, presentation validation, and optional agent adapters.</p><h2>What the application owns</h2><p>The integrating application keeps authentication, authorization, data access, routes, business execution, product policy, and operational responsibility.</p><h2>Open-source boundary</h2><p>The framework, local runtime, components, developer tools, and agent plumbing are Apache-2.0. Source, package, and deployed-site identities are released and verified separately.</p>${next(
      [
        {
          href: '/docs/',
          title: 'Read the documentation',
          description: 'Choose an integration path and build from public contracts.',
        },
        {
          href: 'https://github.com/Arconath/aeliqo',
          title: 'Explore the source',
          description: 'Review implementation, examples, issues, and contribution guidance.',
        },
      ],
    )}`,
  },
  {
    path: '/legal/license/',
    title: 'License',
    section: 'Aeliqo / Legal',
    description: 'The framework and local developer tools use Apache-2.0.',
    body: `<p class="lead">Aeliqo’s public framework is licensed under Apache-2.0.</p><h2>Covered project surface</h2><p>The runtime, component catalog, security and accessibility behavior, local developer tools, testkit, and agent plumbing use the repository license. Review dependency notices for third-party terms.</p><h2>Future services</h2><p>A future hosted organizational service may use a separate commercial boundary. The open-source release does not depend on a license network service and does not place security behavior behind a paid tier.</p><p>Read the <a href="https://github.com/Arconath/aeliqo/blob/main/LICENSE">repository license</a>, trademark guidance, and notices for the controlling terms.</p>`,
  },
  {
    path: '/legal/privacy/',
    title: 'Privacy',
    section: 'Aeliqo / Legal',
    description: 'What the public site, documentation, and local playground store or send.',
    body: `<p class="lead">The documentation and playground are designed to work with synthetic local data and without a model provider.</p><h2>Local playground</h2><p>Filtering and evaluation run in the browser. Playground state is ephemeral unless you export it. Exported task documents must not contain provider credentials or raw sensitive records.</p><h2>Browser storage</h2><p>The site stores a theme preference when storage is available. If production analytics are enabled, the site asks before loading them and stores that choice.</p><h2>Optional analytics</h2><p>The production site may send bounded aggregate page and browser-performance observations after consent. Events exclude query strings, fragments, referrers, form content, direct user identifiers, and persistent session identifiers.</p><h2>External services</h2><p>Opening GitHub or another external link sends a request to that destination. Any future model connection must disclose its egress and require separate host permission.</p>`,
  },
  {
    path: '/legal/security/',
    title: 'Security',
    section: 'Aeliqo / Legal',
    description: 'Understand the host boundary and report sensitive vulnerabilities privately.',
    body: `<p class="lead">Aeliqo validates typed proposals and current contract state. The integrating application remains responsible for authenticated identity, data access, route protection, and business actions.</p><h2>Report a vulnerability</h2><p>Do not include credentials, customer records, or exploit details in a public issue. Use <a href="https://github.com/Arconath/aeliqo/security/advisories/new">GitHub private vulnerability reporting</a>.</p><h2>Include useful evidence</h2><p>Provide the affected exact version, entry point, minimal reproduction, expected boundary, observed behavior, and impact. Remove secrets and unrelated private data.</p><h2>Response expectations</h2><p>The open-source project does not publish a monitored security email address or response-time SLA. The private advisory is the supported sensitive-reporting path.</p>`,
  },
  {
    path: '/legal/support/',
    title: 'Support',
    section: 'Aeliqo',
    description: 'Report reproducible issues against the exact package version and host environment.',
    body: `<p class="lead">The public repository is the support and collaboration surface for Aeliqo 0.1.0.</p><h2>Before opening an issue</h2><p>Confirm the same exact version is used across packages, reduce the problem to a minimal fixture, and check the relevant component or integration page.</p><h2>What to include</h2><p>Share exact versions, browser and framework versions, the smallest non-sensitive fixture, expected and actual behavior, and a diagnostic code or stack trace when available.</p><h2>Sensitive reports</h2><p>Use <a href="/legal/security/">private vulnerability reporting</a> for security issues. The open-source release does not promise a response time or commercial support agreement.</p>`,
  },
  {
    path: '/blog/',
    title: 'Engineering notes',
    section: 'Aeliqo',
    description: 'Notes about the framework’s contracts, implementation, and design decisions.',
    body: `<p class="lead">Longer explanations of the decisions behind Aeliqo.</p><article class="post-link"><p class="eyebrow">DESIGN NOTE · SEPTEMBER 9, 2026</p><h2><a href="/blog/four-concepts/">Why four concepts are enough</a></h2><p>How Catalog, Task, Result, and Experience separate application intent from execution and evidence.</p></article>`,
  },
  {
    path: '/blog/four-concepts/',
    title: 'Why four concepts are enough',
    section: 'Design note · September 9, 2026',
    description: 'Catalog, Task, Result, and Experience separate intent from execution and evidence.',
    body: `<p class="lead">An adaptive interface needs more than a layout suggestion. It needs to know what the data means, what work was requested, and what the result actually supports.</p><h2>Start with ownership</h2><p>The application already knows who the user is, which records they may access, and which actions are valid. Aeliqo should not become a second authority.</p><h2>Describe the work</h2><p>A Catalog captures available entities and meanings. A Task names required outputs and operations. Their structures let an evaluator reject unsupported requests and presentation validation preserve required information.</p><h2>Carry evidence forward</h2><p>A Result carries scope, grain, precision, completeness, and lineage. A filtered count must not acquire a title that implies the whole population.</p><h2>Adapt within constraints</h2><p>Experience describes how the interface should behave alongside accessibility and task requirements. Adaptation can change layout while retaining essential comparisons and authority.</p><h2>Commit against current state</h2><p>The presentation read-set binds the decision to the Catalog, Results, Experience, and grants it used. If one changes, the proposal becomes stale.</p>`,
  },
];
