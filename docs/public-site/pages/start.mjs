import { cards, checklist, code, definePage, install, next, note, source } from './shared.mjs';

export const startPages = [
  definePage('home', {
    title: 'Build your first adaptive interface',
    description:
      'Define one resource, render a validated intent, and let Aeliqo select the right registered view without giving up application control.',
    body: `
<section class="docs-landing-hero"><div><p class="docs-steps-label">Start here · 10 minutes</p><p class="lead">Aeliqo gives your application one contract for adaptive UI. You describe what your data means and what the user may do. Then you send an intent. Aeliqo validates it and chooses a registered view that fits the available space. An agent is optional.</p><div class="docs-landing-actions"><a class="primary" href="/start/">Start the quickstart <span aria-hidden="true">→</span></a><a href="/playground/">See it in the playground</a></div></div><dl class="docs-facts"><div><dt>01</dt><dd>Declare meaning</dd></div><div><dt>02</dt><dd>Send an intent</dd></div><div><dt>03</dt><dd>Adapt the view</dd></div></dl></section>
${note('The boundary in one sentence', 'An agent may propose a typed intent; it cannot provide HTML, JavaScript, SQL, credentials, grants, endpoints, or an unregistered view.', 'boundary')}
<div class="docs-inline-cta"><p><strong>New to Aeliqo?</strong> Start with a read-only resource. You can add agents and write actions after the basic Region works.</p><a href="/start/what-is-aeliqo/">Understand the model first →</a></div>
<h2>Choose your starting point</h2>
${cards([
  {
    title: 'Start a new app',
    body: 'Build one complete resource-to-Region path. Every file is shown; nothing is hidden behind a helper.',
    href: '/start/',
    label: 'Follow the quickstart',
  },
  {
    title: 'Add it to an existing app',
    body: 'Adopt one surface while keeping your backend, router, state, and design system in charge.',
    href: '/start/existing-app/',
    label: 'See the integration path',
  },
  {
    title: 'Connect an agent',
    body: 'Expose three bounded tools through MCP, experimental WebMCP, or a provider-agnostic BYOK host.',
    href: '/agents/quickstart/',
    label: 'Connect safely',
  },
  {
    title: 'Explore working scenarios',
    body: 'Run People, Products, Support, and Knowledge through the same public runtime.',
    href: '/playground/',
    label: 'Open the playground',
  },
])}
<h2>How a request becomes UI</h2>
<p>There is no magic step between your intent and the screen. Each stage has a contract, a boundary, and a visible outcome.</p>
<ol class="concept-flow"><li><span>01</span><div><h3>Intent</h3><p>Application code or an agent asks to browse, inspect, compare, analyze, create, or edit a registered resource.</p></div></li><li><span>02</span><div><h3>Task and Result</h3><p>Aeliqo compiles the request, rechecks authority, evaluates a bounded data source, and retains scope and revision evidence.</p></div></li><li><span>03</span><div><h3>Recipe</h3><p>The web layer selects only an allowed view that fits the task and current container.</p></div></li><li><span>04</span><div><h3>Commit</h3><p>A current, valid proposal replaces the Region atomically; stale work cannot overwrite a newer request.</p></div></li></ol>
<h2>Three ideas to keep in mind</h2>
${cards([
  {
    title: 'Meaning before markup',
    body: 'Fields carry roles, units, and temporal meaning. Aeliqo can only choose a good view when the application supplies that meaning.',
    href: '/concepts/semantics/',
    label: 'Read semantics',
  },
  {
    title: 'Intent is not permission',
    body: 'An intent describes what to show or do. Current authority comes from the host, not from an agent payload or a user-editable field.',
    href: '/concepts/safety/',
    label: 'Read the safety model',
  },
  {
    title: 'Adaptive does not mean lossy',
    body: 'A table may become cards on a narrow container, but the same records, identity, filters, and draft state stay intact.',
    href: '/guides/responsive-behavior/',
    label: 'See responsive behavior',
  },
])}
${next([
  {
    href: '/start/what-is-aeliqo/',
    title: 'What is Aeliqo?',
    description: 'Understand the framework boundary before writing code.',
  },
  { href: '/start/', title: 'Quickstart', description: 'Run a real adaptive Region without an agent.' },
])}`,
  }),

  definePage('what-is', {
    title: 'What is Aeliqo?',
    description:
      'A framework that compiles bounded application intent into registered UI, with evidence and authority checked at every boundary.',
    body: `
<p class="lead">Aeliqo is the runtime between product intent and rendering. Your application stays in charge of meaning, data, authority, and business actions. Aeliqo turns that contract into a safe interface that can adapt without a model call.</p>
<div class="docs-proof"><header><div><span class="product-mark" aria-hidden="true">A</span><strong>The short version</strong></div><span>same contract · different view</span></header><div class="docs-proof-grid"><div><small>Developer registers</small><strong>People + meaning + permission</strong><p>What the resource is and what this user may see or change.</p></div><span aria-hidden="true">→</span><div><small>Aeliqo returns</small><strong>Table on wide · cards on narrow</strong><p>The same Result, identity, selection, and state—presented for the container.</p></div></div></div>
<h2>Why it exists</h2><p>Without Aeliqo, every screen wires query state, responsive alternatives, empty/error states, cancellation, stale-result protection, accessibility behavior, and agent tooling independently. Aeliqo centralizes those mechanics while leaving product meaning and authority in the application.</p>
<h2>Who owns what</h2><div class="ownership-grid"><article><span>Developer owns</span><ul><li>Resource meaning and identity</li><li>Data adapters and server authorization</li><li>Allowed actions, routes, and custom views</li><li>Product-specific policy and copy</li></ul></article><article><span>Aeliqo owns</span><ul><li>Intent validation and Task compilation</li><li>Bounded evaluation and Result evidence</li><li>Recipe selection and responsive adaptation</li><li>Region lifecycle, cancellation, and receipts</li></ul></article><article><span>Agent may do</span><ul><li>Discover allowed capabilities</li><li>Propose a validated intent</li><li>Request preview or execution of a registered action</li><li>Explain outcomes returned by the runtime</li></ul></article></div>
<h2>It works without AI</h2><p>Call <code>app.render({intent})</code> from a button, route, filter form, command palette, test, or server-driven workflow. An agent uses the same intent envelope and cannot bypass the compiler or authority checks.</p>
<div class="docs-inline-cta"><p><strong>Think of an agent as a requester.</strong> It can ask for a view; it never becomes your renderer or authorization server.</p><a href="/agents/">Connect an agent →</a></div>
<h2>It is for more than dashboards</h2><p>Browse people as table or cards, compare products, edit support tickets, search knowledge content, render forms, and connect host navigation. Analytics is one recipe family—not the framework’s identity.</p>
${next([
  {
    href: '/concepts/',
    title: 'System concepts',
    description: 'Understand Catalog, Intent, Task, Result, Recipe, and Region.',
  },
  { href: '/start/', title: 'Build it', description: 'See the complete code and visible result.' },
])}`,
  }),

  definePage('quickstart', {
    title: 'Quickstart: one adaptive resource',
    description:
      'Define People, connect permitted local records, mount a Region, and render table or cards from one intent.',
    body: `
<p class="lead">You will build a People collection that uses a table in a wide container and cards in a narrow container. The intent is explicit, the data is synthetic, and no model call is involved.</p>
<div class="docs-inline-cta"><p><strong>What you will finish with:</strong> one <code>createAeliqoApp</code>, one mounted Region, and one <code>app.render</code> call.</p><a href="/playground/?scenario=people">Preview the result →</a></div>
${note('Prerequisites', 'Use Node.js 24, pnpm 11, TypeScript, and a browser entry with one empty element such as <code>&lt;main id="people"&gt;&lt;/main&gt;</code>. Keep all Aeliqo packages on one exact version.')}
<h2>1. Install</h2><p>Install the core contract, runtime orchestration, and web renderer together at the same version.</p>${install}
<h2>2. Define the resource and runtime</h2><p>This is the complete application wiring. It defines meaning, connects a bounded local source, supplies trusted authority, and mounts one Region. The docs build reads it from a type-checked fixture—there is no hidden helper file.</p>
${source('src/app.ts', 'examples/quickstart/src/app.ts')}
<h2>3. Mount and render an intent</h2><p>The browser only needs a target element and the intent you want to show. The runtime handles validation, evaluation, view selection, and lifecycle.</p>${code(
      'browser.ts',
      `import {mountPeople} from './app.js';

const people = mountPeople(document.querySelector('#people'), [
  {id: 'ada', name: 'Ada Chen', team: 'Design'},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering'},
]);

const receipt = await people.render();
if (receipt.status !== 'renderer-ready') console.error(receipt.diagnostics);`,
    )}
<h2>What you supplied</h2><p>The schema and field roles establish meaning. The local service establishes data and read limits. The authority adapter supplies trusted current context. The mount identifies one Region. Aeliqo compiles the browse intent and chooses the registered responsive recipe.</p>
<h2>What you should see</h2>${checklist(['Wide Region: a keyboard-accessible table with Name and Team.', 'Narrow Region: equivalent cards with the same records and selection identity.', 'A denied principal: a typed denied receipt, not leaked rows.', 'A newer render request: cancellation of obsolete work so late results cannot commit.'])}
<h2>Failure recovery</h2><div class="doc-table"><table><thead><tr><th>Outcome</th><th>Fix</th></tr></thead><tbody><tr><th><code>unsupported</code></th><td>Check the resource intent and allowed view registrations.</td></tr><tr><th><code>denied</code></th><td>Fix host authorization; never add a grant to the intent payload.</td></tr><tr><th><code>failed</code></th><td>Read the bounded diagnostic and keep the previous valid view.</td></tr><tr><th><code>cancelled</code></th><td>Usually expected after a newer render or disposal; do not retry blindly.</td></tr></tbody></table></div>
${next([
  {
    href: '/guides/resources/',
    title: 'Define resources',
    description: 'Add business meaning, forms, and presentations.',
  },
  {
    href: '/guides/adaptive-region/',
    title: 'Region lifecycle',
    description: 'Handle render, subscribe, cancellation, and disposal.',
  },
])}`,
  }),

  definePage('existing-app', {
    title: 'Add Aeliqo to an existing application',
    description:
      'Adopt one Region at a time while keeping the existing backend, router, state, components, and authorization system.',
    body: `
<p class="lead">Start at a boundary where the application already knows the current user and can provide a bounded data adapter. Do not migrate the whole UI at once.</p>
<h2>Integration sequence</h2><ol class="doc-steps"><li><span>1</span><div><h3>Choose one resource</h3><p>Pick a read-only collection or detail surface with stable identity and clear ownership.</p></div></li><li><span>2</span><div><h3>Project the data</h3><p>Map the existing API response into a typed resource shape. Keep credentials and server policy in the existing backend.</p></div></li><li><span>3</span><div><h3>Bridge authority</h3><p>Read the effective principal and grants from trusted application state for every evaluation and commit.</p></div></li><li><span>4</span><div><h3>Mount one Region</h3><p>Use a dedicated container and dispose it with the host view lifecycle.</p></div></li><li><span>5</span><div><h3>Add actions last</h3><p>Reuse the current business command path with preview, confirmation, revision, and idempotency policy.</p></div></li></ol>
${note('Do not duplicate ownership', 'If your router owns the URL, register a navigation adapter. If your form library owns a draft, keep it as the source of truth or move that entire bounded form into an Aeliqo recipe. Two competing owners create lost state.', 'warning')}
<h2>Definition of success</h2>${checklist(['The existing non-Aeliqo path still works.', 'Back/forward navigation and unmount do not leak listeners or stale data.', 'The server remains the final authorization boundary.', 'Aeliqo can be removed from this surface without changing the domain API.'])}
${next([
  {
    href: '/guides/data/',
    title: 'Data adapters',
    description: 'Map local and HTTP sources without pretending an arbitrary REST endpoint is universal.',
  },
  {
    href: '/start/frameworks/',
    title: 'Framework setup',
    description: 'Choose Vanilla, React, Vue, or SSR integration.',
  },
])}`,
  }),

  definePage('standalone', {
    title: 'Standalone web components',
    description: 'Use a published component directly when the application already owns rows and interaction state.',
    body: `
<p class="lead">A Region is optional. Standalone components are the smaller choice for an existing screen that only needs a table, form control, navigation element, feedback pattern, or chart.</p>
<h2>Register narrowly</h2>${code(
      'records.ts',
      `import {AeliqoRecordListElement} from '@aeliqo/web/record-list';

if (!customElements.get('aeliqo-record-list')) {
  customElements.define('aeliqo-record-list', AeliqoRecordListElement);
}

const list = document.querySelector('aeliqo-record-list');
list.identity = ['id'];
list.columns = [{key: 'name', label: 'Name'}];
list.rows = [{id: 'ada', name: 'Ada Chen'}];`,
    )}
<h2>Boundary rules</h2>${checklist(['Pass arrays and objects as properties, not serialized attributes.', 'Treat emitted event detail as untrusted input and recheck permissions before a side effect.', 'Exercise loading, empty, partial, stale, denied, and error states that apply.', 'Use public theme tokens and shadow parts; do not depend on internal shadow markup.'])}
${next([
  {
    href: '/components/',
    title: 'Component catalog',
    description: 'Inspect generated declarations, states, examples, and styling hooks.',
  },
  {
    href: '/guides/adaptive-region/',
    title: 'Upgrade to a Region',
    description: 'Add typed intent and adaptive recipe selection.',
  },
])}`,
  }),

  definePage('frameworks', {
    title: 'Framework setup',
    description:
      'Use the same web implementation from Vanilla, React, Vue, and server-rendered hosts without creating a second renderer.',
    body: `
<h2>Vanilla</h2><p>Call <code>createAeliqoApp</code>, mount against an <code>HTMLElement</code>, and dispose when the host removes the surface.</p>
<h2>React</h2>${code(
      'PeopleRegion.tsx',
      `import {AeliqoProvider, AeliqoRegion} from '@aeliqo/react/app';

export function PeopleRegion({app}) {
  return <AeliqoProvider app={app}>
    <AeliqoRegion regionId="people-main" resourceId="people" />
  </AeliqoProvider>;
}`,
    )}
<h2>Vue and other custom-element hosts</h2><p>Register the Aeliqo elements once, pass structured properties through element refs, and listen for native custom events. Framework-specific wrappers are unnecessary unless they improve typing or lifecycle ergonomics.</p>
<h2>SSR and hydration</h2><p>Import server-safe entry points during module evaluation. Browser registration belongs in a client boundary. Verify that hydration does not duplicate listeners, reset draft inputs, or share runtime authority between requests.</p>
${checklist(['One runtime instance per application security context.', 'One mount/dispose pair per Region lifecycle.', 'No DOM access from server module evaluation.', 'No second compiler or renderer implemented in the framework wrapper.'])}
${next([
  {
    href: '/ship/ssr/',
    title: 'SSR and hydration',
    description: 'Review request isolation, registration, and fallback behavior.',
  },
  { href: '/reference/app-api/', title: 'App API', description: 'Read lifecycle signatures and outcomes.' },
])}`,
  }),
];
