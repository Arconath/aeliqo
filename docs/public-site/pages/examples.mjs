import { cards, checklist, definePage, next, note, project } from './shared.mjs';

const shared = `<h2>Run the complete starter</h2><ol class="doc-steps"><li><span>1</span><div><h3>Create the files below</h3><p>Every required file is included. There is no undocumented helper or workspace alias.</p></div></li><li><span>2</span><div><h3>Install and start</h3><p>Run <code>pnpm install</code>, then <code>pnpm dev</code>.</p></div></li><li><span>3</span><div><h3>Inspect the result</h3><p>The status changes to <code>renderer-ready</code> and the synthetic records appear through a real Aeliqo Region.</p></div></li></ol>
<h2>What you own</h2>${checklist(['Replace the synthetic records with your application data adapter.', 'Replace the local principal and policy with trusted host authority.', 'Keep resource identity and business meaning explicit.', 'Dispose the app when the host removes the surface.'])}
<h2>Failure and recovery</h2><p>An unknown field or view returns a diagnostic and leaves the last permitted UI intact. A denied authority read does not evaluate data. Fix the contract or trusted policy, then send the intent again; do not bypass validation.</p>
<h2>Inspect the full journey</h2>${checklist(['Run Guided demo to send deterministic intent fixtures through the real runtime.', 'Use Manual controls to exercise the same behavior without an agent.', 'Open Inspector to see intent, compiled Task, Result descriptor, chosen view, policy reason, and diagnostics.', 'Resize the Region—not only the page—to verify equivalent responsive behavior.', 'Reset restores the synthetic session and removes local demo writes.'])}`;

export const examplePages = [
  definePage('examples', {
    title: 'Runnable examples',
    description:
      'Four synthetic applications prove that one pipeline supports records, commerce, support workflows, and knowledge content—not only dashboards.',
    body: `<p class="lead">Every example is a real consumer of the public 0.3 API. Scenario fixtures define resources, permitted local data, actions, intents, and optional extensions; the shared playground owns session and presentation lifecycle.</p>
${cards([
  {
    title: 'People',
    body: 'Browse, filter, detail, and analyze a temporal meaning. Table becomes cards only when task semantics permit.',
    href: '/examples/people/',
    label: 'Open example',
  },
  {
    title: 'Products',
    body: 'Grid or list, detail, comparison, and a product form.',
    href: '/examples/products/',
    label: 'Open example',
  },
  {
    title: 'Support',
    body: 'Search, ticket detail, edit draft, status action, confirmation, and recovery.',
    href: '/examples/support/',
    label: 'Open example',
  },
  {
    title: 'Knowledge',
    body: 'Content search, article reading, navigation, and a consumer-owned custom view and intent.',
    href: '/examples/knowledge/',
    label: 'Open example',
  },
])}
${note('Synthetic by design', 'Public demo data contains no customer records. Demo writes live only in the local session and can be reset.')}
${next([
  { href: '/playground/', title: 'Open playground', description: 'Run all four scenarios through one interface.' },
  { href: '/start/', title: 'Build your own', description: 'Start from the compiled minimal consumer.' },
])}`,
  }),

  definePage('people-example', {
    title: 'People example',
    description: 'Browse, filter, detail, and trend over a registered People resource with correct temporal meaning.',
    body: `<p class="lead">People demonstrates the familiar table-to-cards adaptation without making dashboards the framework’s identity.</p>
<h2>Registered contract</h2><p>Stable employee identity, readable fields, team dimension, active status, and a versioned absence meaning with explicit period and grain.</p>
<h2>Journeys</h2>${checklist(['Browse active people and sort by name.', 'Filter a team without losing selection identity.', 'Open one person in detail and preserve back context on narrow layouts.', 'Analyze the registered absence measure by permitted temporal grain.', 'Reject a made-up field, invalid aggregate, or unregistered view.'])}
${shared}<p><a class="primary" href="/playground/?scenario=people">Run People in the playground →</a></p>
<h2>Complete source</h2>${project('people')}
${next([
  {
    href: '/concepts/semantics/',
    title: 'Why the trend is valid',
    description: 'Understand meaning, period, unit, and grain.',
  },
  { href: '/examples/products/', title: 'Products', description: 'Move beyond table-first UI.' },
])}`,
  }),

  definePage('products-example', {
    title: 'Products example',
    description: 'Browse a visual catalog, inspect details, compare products, and open a schema-backed form.',
    body: `<p class="lead">Products proves that Aeliqo can select grid, list, comparison, detail, and form recipes from one resource—without generated HTML.</p>
<h2>Journeys</h2>${checklist(['Browse products as grid on wide containers and an equivalent list or cards on narrow containers.', 'Open detail using stable product identity.', 'Compare selected products without collapsing essential attributes.', 'Open a registered create/edit form without executing a write.', 'Preserve filters and comparison selection across valid adaptation.'])}
${shared}<p><a class="primary" href="/playground/?scenario=products">Run Products in the playground →</a></p>
<h2>Complete source</h2>${project('products')}
${next([
  { href: '/guides/forms/', title: 'Form recipe', description: 'See draft and action ownership.' },
  { href: '/examples/support/', title: 'Support', description: 'Exercise confirmation and status changes.' },
])}`,
  }),

  definePage('support-example', {
    title: 'Support example',
    description:
      'Search tickets, inspect details, edit a draft, and move status through a confirmed application action.',
    body: `<p class="lead">Support demonstrates business UI: records contain untrusted text, but that text cannot expand grants, install code, or trigger a status write.</p>
<h2>Journeys</h2>${checklist(['Search permitted tickets across registered text fields.', 'Open ticket detail while keeping list context.', 'Edit nested form values with validation and dirty-draft preservation.', 'Preview a status action, require trusted confirmation, and execute with idempotency.', 'Show denied, stale entity, failed, and ambiguous write outcomes distinctly.'])}
${shared}<p><a class="primary" href="/playground/?scenario=support">Run Support in the playground →</a></p>
<h2>Complete source</h2>${project('support')}
${next([
  {
    href: '/guides/actions/',
    title: 'Action boundary',
    description: 'Implement preview, confirmation, execution, and reconciliation.',
  },
  { href: '/examples/knowledge/', title: 'Knowledge', description: 'See a custom content presentation.' },
])}`,
  }),

  definePage('knowledge-example', {
    title: 'Knowledge example',
    description:
      'Search content, read an article, navigate between results, and render a consumer-owned custom presentation.',
    body: `<p class="lead">Knowledge proves extension outside tables, cards, and analytics. The application registers a content-oriented custom intent and view; no core package is edited.</p>
<h2>Journeys</h2>${checklist(['Search article title and summary using a browse intent.', 'Open a single-column reading layout with host-owned navigation.', 'Use a namespaced custom intent compiled into the normal Task contract.', 'Render a trusted custom view with cancellation and disposal.', 'Reject duplicate registration, unknown import paths, and state transfer that would lose context.'])}
${shared}<p><a class="primary" href="/playground/?scenario=knowledge">Run Knowledge in the playground →</a></p>
<h2>Complete source</h2>${project('knowledge')}
${next([
  {
    href: '/guides/custom-views/',
    title: 'Build an extension',
    description: 'Register custom view and intent contracts.',
  },
  { href: '/examples/', title: 'All examples', description: 'Compare the four domain shapes.' },
])}`,
  }),
];
