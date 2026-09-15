import { cards, checklist, code, definePage, next, note } from './shared.mjs';

export const buildPages = [
  definePage('resources', {
    title: 'Define resources',
    description:
      'Describe runtime shape, stable identity, business meaning, forms, and allowed presentations in one application-owned definition.',
    body: `<p class="lead">A resource is the trusted bridge between domain data and Aeliqo. Zod provides runtime validation; metadata explains what fields mean and which UI choices are valid.</p>
<h2>Minimal definition</h2>${code(
      'people.ts',
      `import {defineResource} from '@aeliqo/core';
import {z} from 'zod';

export const people = defineResource({
  id: 'people', revision: 'people-1', label: 'People', identity: ['id'],
  schema: z.object({id: z.string(), name: z.string(), team: z.enum(['Design', 'Engineering'])}),
  fields: {name: {label: 'Name'}, team: {label: 'Team', role: 'dimension'}},
  presentation: {allowedViews: ['table', 'cards']},
});`,
    )}
<h2>Identity is mandatory</h2><p>Identity preserves selection, detail targeting, revisions, and state transfer. It is not a display label and is not inferred from row order.</p>
<h2>Closed values are part of the contract</h2><p>Zod enum and literal values are exposed through permitted context and validated before a query runs. A filter must use the exact registered value; a model cannot silently turn <code>Open</code> into an unrelated or empty result by sending <code>open</code>.</p>
<h2>Technical type is not business meaning</h2><p>A numeric field only says how a value is represented. Aggregation, unit, temporal grain, and definitions such as “absence rate” belong in a versioned Catalog meaning. Add reviewed <code>meanings</code> to a generated resource or pass an existing Catalog; Aeliqo never assumes every number is summable or every date forms a valid trend. Generated date schemas use an explicit Gregorian/UTC/day policy unless field metadata supplies a different semantic type.</p>
<h2>Use an existing Catalog</h2><p>Pass <code>catalog</code> and <code>entity</code> when the application already maintains a richer relational contract. The Zod schema must still cover the selected entity fields so runtime records remain inspectable.</p>
${note('Unsupported schema', 'Nested objects are not silently flattened into analytics. Project them into stable scalar fields or bind them to a typed custom presentation. The diagnostic points to the unsupported field.', 'boundary')}
${next([
  {
    href: '/concepts/semantics/',
    title: 'Semantic meaning',
    description: 'Model units, measures, grain, and temporal policy.',
  },
  { href: '/guides/data/', title: 'Connect data', description: 'Bind the resource to a bounded source.' },
])}`,
  }),

  definePage('data', {
    title: 'Data adapters',
    description:
      'Connect local records, the Aeliqo HTTP protocol, or an application adapter without leaking credentials or inventing REST semantics.',
    body: `<p class="lead">Every resource binding supplies a <code>DataService</code>. The runtime plans and evaluates the same query contract regardless of where data lives.</p>
<h2>Choose the correct boundary</h2>${cards([
      {
        title: 'Local snapshot',
        body: 'Use when rows are already authorized and bounded in the browser or worker.',
        href: '/guides/local-data/',
        label: 'Local guide',
      },
      {
        title: 'Application server',
        body: 'Use the Aeliqo HTTP contract when records or credentials must stay on the server.',
        href: '/guides/http-data/',
        label: 'HTTP guide',
      },
      {
        title: 'Custom source',
        body: 'Implement the small DataService interface and map filtering, sort, pagination, results, errors, and cancellation explicitly.',
      },
    ])}
<h2>No universal REST shortcut</h2><p><code>rest('/api/employees')</code> cannot know an arbitrary API’s pagination, permissions, null semantics, revisions, or error model. Build a deliberate adapter and test each mapping.</p>
<h2>Required behavior</h2>${checklist(['Validate all remote responses before materializing a Result.', 'Preserve source revision, scope digest, identity, grain, precision, and completeness.', 'Propagate cancellation to actual source work.', 'Enforce row, byte, column, request, and materialization limits.', 'Clear no-longer-authorized data after principal or scope changes.'])}
<h2>Audit without data leakage</h2><p>The local audit exporter accepts fixed event shapes and bounded numeric observations. Do not include record payloads, prompts, credentials, query strings, or direct identity.</p>
${next([
  {
    href: '/guides/permissions/',
    title: 'Permissions',
    description: 'Supply trusted context to every evaluation and commit.',
  },
  {
    href: '/concepts/safety/',
    title: 'Safety model',
    description: 'Understand why browser validation does not replace server authorization.',
  },
])}`,
  }),

  definePage('local-data', {
    title: 'Local data service',
    description: 'Evaluate canonical queries over a bounded, application-owned snapshot with no network and no AI.',
    body: `<p class="lead">Use local data for synthetic demos, offline tools, tests, and records the application already has permission to expose.</p>
<h2>Create the service</h2>${code(
      'data.ts',
      `const data = createLocalDataService({
  snapshot: {
    catalog: people.catalog,
    sourceRevision: 'people-data-1',
    records: {people: permittedRecords},
  },
  functionRegistry,
  sourceLimits: {rows: 1_000, bytes: 1_000_000},
  authorize: ({context}) => authorizePeople(context.principal),
});`,
    )}
<h2>Keep it bounded</h2><p>The snapshot is not a client-side database mirror. Limit the records before binding them, paginate large collections, and dispose materialized results when the Region or authority context changes.</p>
<h2>Failure recovery</h2><p>An unsupported query returns a diagnostic without mutating the current Region. A cancelled evaluation releases pending work. A denied request must not retain rows from an earlier principal.</p>
${next([
  { href: '/start/', title: 'Complete quickstart', description: 'See this adapter in the compiled People example.' },
  {
    href: '/guides/http-data/',
    title: 'Move execution server-side',
    description: 'Keep private source records out of the browser.',
  },
])}`,
  }),

  definePage('http-data', {
    title: 'HTTP data service',
    description:
      'Keep authenticated identity, credentials, source policy, and private records in the application server.',
    body: `<p class="lead">The browser sends a bounded query. The application service authenticates the request, derives current source policy, and executes against a private source.</p>
<h2>Trust boundary</h2><div class="boundary-diagram" role="img" aria-label="Browser intent reaches an authenticated application service before the private source"><div>Browser Region<small>Intent + cancellation</small></div><span aria-hidden="true">→</span><div>Application service<small>Identity + policy</small></div><span aria-hidden="true">→</span><div>Private source<small>Authorized execution</small></div></div>
${note('Never trust wire authority', 'Principal IDs, grants, policies, credentials, or endpoint URLs received from the browser or agent are data—not authority. Derive trusted context inside the host.', 'warning')}
<h2>Map the complete protocol</h2>${checklist(['Discovery exposes only metadata allowed for the authenticated session.', 'Filter, sort, pagination, nulls, units, revisions, partial results, and errors have explicit mappings.', 'Request abort reaches the database or upstream request.', 'Malformed or over-budget messages fail closed.', 'Server authorization is checked again before reads and writes.'])}
${next([
  {
    href: '/guides/permissions/',
    title: 'Authority adapter',
    description: 'Unify evaluator, Region, action, and agent context.',
  },
  { href: '/ship/', title: 'Production checks', description: 'Verify source isolation and failure handling.' },
])}`,
  }),

  definePage('permissions', {
    title: 'Permissions and authority',
    description: 'Provide one trusted host adapter for principal, scope, policy revision, grants, and query context.',
    body: `<p class="lead">Authority is read from the host immediately before evaluation, presentation commit, and action execution. It is never accepted from an intent.</p>
<h2>Adapter</h2>${code(
      'authority.ts',
      `const authority = {
  read: ({resourceId, regionId, effect, signal}) => {
    const session = currentAuthenticatedSession();
    return session.canUse(resourceId, effect)
      ? {ok: true, value: {
          principalKey: session.principalKey,
          scopeDigest: session.scopeDigest,
          policyRevision: session.policyRevision,
          experienceRevision: 'web-1',
          grants: session.aeliqoGrants,
          readContext: {principal: session.principalKey},
        }}
      : denied(resourceId, regionId);
  },
};`,
    )}
<h2>Revocation behavior</h2><p>If principal, scope, or policy changes while work is running, the commit fails stale. When access is removed, unmount or rerender the Region so previously visible unauthorized data is cleared.</p>
<h2>Server remains final</h2><p>Browser checks improve UX and contain agent capability. They are not a substitute for authenticated server authorization on remote reads or business actions.</p>
${next([
  {
    href: '/concepts/safety/',
    title: 'Safety infrastructure',
    description: 'See the checks that make invalid proposals non-executable.',
  },
  { href: '/guides/actions/', title: 'Business actions', description: 'Apply the same authority model to writes.' },
])}`,
  }),

  definePage('actions', {
    title: 'Business actions',
    description:
      'Register schema-validated commands with permission, confirmation, revision, idempotency, and ambiguous-completion handling.',
    body: `<p class="lead">An action is trusted application code behind an Aeliqo boundary. The agent or form may provide bounded JSON input; only the host can confirm and dispatch a registered command.</p>
<h2>Lifecycle</h2><ol class="concept-flow"><li><span>01</span><div><h3>Preview</h3><p>Validate action identity, input schema, permission, entity revision, size, and idempotency policy.</p></div></li><li><span>02</span><div><h3>Confirm</h3><p>The trusted host or user interaction issues confirmation. An agent cannot confirm itself.</p></div></li><li><span>03</span><div><h3>Execute</h3><p>Recheck current authority and revision, then dispatch once through the registered application command.</p></div></li><li><span>04</span><div><h3>Reconcile</h3><p>Show executed, rejected, or ambiguous completion. Cancellation after a remote write is not a rollback.</p></div></li></ol>
<h2>Payloads</h2><p>Inputs and outputs are bounded schema-validated JSON, including nested form groups, repeaters, and multiselect values. Files use host-owned upload references; arbitrary bytes do not travel through an agent argument.</p>
${note('Do not auto-retry uncertainty', 'If the remote system may have completed a write, return an ambiguous receipt and provide a reconciliation path. Retrying may duplicate the command.', 'warning')}
${next([
  { href: '/guides/forms/', title: 'Forms', description: 'Bind create and edit recipes to registered actions.' },
  {
    href: '/agents/quickstart/',
    title: 'Agent actions',
    description: 'Expose preview and execution through the bounded tool endpoint.',
  },
])}`,
  }),

  definePage('forms', {
    title: 'Create and edit forms',
    description:
      'Generate registered form recipes from schemas while preserving draft ownership, validation, and the action boundary.',
    body: `<p class="lead">A create or edit intent opens a form; it never performs the write. Submission produces an action preview and follows the registered confirmation policy.</p>
<h2>Register form bindings</h2>${code(
      'resource.ts',
      `const people = defineResource({
  // schema, identity, fields…
  intents: ['browse', 'detail', 'create', 'edit'],
  forms: {
    create: {schema: {id: 'people-form', revision: '1'}, action: {id: 'people.create', revision: '1'}},
    edit: {schema: {id: 'people-form', revision: '1'}, action: {id: 'people.update', revision: '1'}},
  },
  presentation: {allowedViews: ['table', 'cards', 'form']},
});`,
    )}
<h2>Edit state is host-owned evidence</h2><p>Supply a <code>formState</code> adapter for edit values and entity revision. Aeliqo never invents current field values from an agent proposal.</p>
<h2>UX contract</h2>${checklist(['Visible labels, helper text, inline errors, and a validation summary.', 'Dirty draft survives valid responsive adaptation.', 'Reset and cancel are explicit and restore focus.', 'Nested groups, repeaters, and multiselect use bounded JSON schemas.', 'Submission status distinguishes pending, failed, executed, and ambiguous.'])}
${next([
  {
    href: '/guides/actions/',
    title: 'Action boundary',
    description: 'Implement confirmation and idempotency correctly.',
  },
  {
    href: '/concepts/state-ownership/',
    title: 'Draft ownership',
    description: 'Prevent state loss during adaptation.',
  },
])}`,
  }),

  definePage('navigation', {
    title: 'Navigation',
    description:
      'Keep the host router in control while Aeliqo preserves selection and back context across adaptive views.',
    body: `<p class="lead">Navigation is a host adapter, not a universal workflow engine. Aeliqo can request a registered route transition; the application owns URL policy, guards, history, and loading.</p>
<h2>Recommended mapping</h2>${code(
      'navigation.ts',
      `const navigation = {
  open: ({resourceId, identity}) => router.push(resourceRoute(resourceId, identity)),
  back: () => router.back(),
};`,
    )}
<h2>Preserve context</h2><p>A wide master-detail view may become list then detail on a narrow container. The selected identity, filter, scroll context, and a discoverable Back action must survive that change.</p>
${checklist(['Back/forward restores the equivalent Region state.', 'Unknown or unauthorized destinations are rejected by the host.', 'A route change cancels obsolete evaluation and renderer loading.', 'Focus moves to the new page or detail heading and returns predictably.'])}
${next([
  {
    href: '/guides/responsive-behavior/',
    title: 'Responsive behavior',
    description: 'See the default cross-container policy.',
  },
  {
    href: '/concepts/state-ownership/',
    title: 'Selection ownership',
    description: 'Understand which state transfers between views.',
  },
])}`,
  }),

  definePage('responsive', {
    title: 'Responsive behavior',
    description:
      'Adapt registered views from container conditions without another model call or silent information loss.',
    body: `<p class="lead">The default policy considers the task, semantics, allowed recipes, and Region container—not only viewport or user agent.</p>
<h2>Default behavior</h2><div class="doc-table"><table><thead><tr><th>Need</th><th>Wide</th><th>Narrow</th></tr></thead><tbody><tr><th>Browse</th><td>Table or grid</td><td>Cards or list</td></tr><tr><th>Detail</th><td>Master-detail when valid</td><td>Detail with back context</td></tr><tr><th>Create/edit</th><td>Grouped form</td><td>Stacked form or wizard</td></tr><tr><th>Compare</th><td>Side by side</td><td>Equivalent comparison</td></tr><tr><th>Analyze trend</th><td>Chart plus exact values</td><td>Compact chart plus exact values</td></tr><tr><th>Content</th><td>Reading layout with navigation</td><td>Single-column reading layout</td></tr></tbody></table></div>
${note('Table does not always become cards', 'If simultaneous column comparison is essential, an accessible horizontally scrollable table may be the correct narrow view. The task contract wins over a cosmetic breakpoint.')}
<h2>Transition guards</h2><p>Adaptation coalesces resize signals and waits through active typing, IME composition, drag, and dirty draft transitions. If no equivalent allowed view exists, it keeps the current valid presentation.</p>
${next([
  {
    href: '/guides/adaptive-region/',
    title: 'Adaptive Region',
    description: 'Use the lifecycle and inspect selected recipes.',
  },
  {
    href: '/guides/custom-views/',
    title: 'Custom views',
    description: 'Add a domain-specific renderer without changing core.',
  },
])}`,
  }),

  definePage('adaptive-region', {
    title: 'Adaptive Region lifecycle',
    description:
      'Mount once, render typed intent, observe sanitized state, and dispose all work with the host surface.',
    body: `<p class="lead">A Region is the unit of evaluation, presentation, supersession, and cleanup. Newer requests replace older requests only within the same Region.</p>
<h2>Lifecycle API</h2>${code(
      'region.ts',
      `const mounted = app.mount({target, regionId: 'main', resourceId: 'people'});
if (!mounted.ok) throw new Error(mounted.diagnostics[0].message);

const unsubscribe = app.subscribe('main', (state) => renderStatus(state.phase));
const receipt = await app.render({regionId: 'main', intent});

unsubscribe();
app.unmount('main');
app.dispose();`,
    )}
<h2>Receipt meaning</h2><div class="doc-table"><table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody><tr><th><code>renderer-ready</code></th><td>Runtime evidence committed and the renderer accepted the validated presentation; it is not proof of browser paint or user attention.</td></tr><tr><th><code>needs-input</code></th><td>The request is valid but needs a user choice or form input.</td></tr><tr><th><code>denied</code></th><td>Current trusted authority rejected the operation.</td></tr><tr><th><code>cancelled</code></th><td>A newer render, abort signal, unmount, or disposal superseded the request.</td></tr><tr><th><code>unsupported</code></th><td>No valid registered contract can perform the request.</td></tr><tr><th><code>failed</code></th><td>A bounded internal or adapter failure occurred; inspect diagnostics and recovery.</td></tr></tbody></table></div>
<h2>Failure invariant</h2><p>An invalid presentation preserves the previous view while it remains authorized. Revocation is different: data that may no longer be displayed is cleared.</p>
${next([
  {
    href: '/reference/app-api/',
    title: 'App API reference',
    description: 'Review exact methods, ownership, and lifecycle.',
  },
  { href: '/concepts/safety/', title: 'Commit safety', description: 'See revision and read-set validation.' },
])}`,
  }),

  definePage('custom-views', {
    title: 'Custom views',
    description:
      'Register a typed application renderer with explicit identity, capability, input contract, and lifecycle.',
    body: `<p class="lead">Custom views are trusted application code. They may wrap a Web Component or host framework component, but an agent cannot install them or supply an import path.</p>
<h2>Define and register</h2>${code(
      'kanban.ts',
      `const kanban = defineView({
  manifest: {id: 'support.kanban', revision: '1', intents: ['browse']},
  assess: ({task, result, environment}) => assessKanban(task, result, environment),
  render: ({host, result, signal}) => mountKanban(host, result, signal),
});

const app = createAeliqoApp({resources, authority, views: [kanban]});`,
    )}
<h2>Extension contract</h2>${checklist(['Namespaced identity and version are stable.', 'Input schema and supported capabilities are explicit.', 'Assessment is synchronous, pure, and bounded.', 'Render supports cancellation and complete disposal.', 'State mapping declares which selection, draft, focus, and navigation context can transfer.', 'Duplicate or incompatible registration fails before use.'])}
<h2>Core stays unchanged</h2><p>If a custom view or intent can express its needs through Task, Result, presentation manifest, and state mapping, it belongs in consumer code. Add a core primitive only when multiple independent domains reveal a missing invariant.</p>
${next([
  {
    href: '/examples/knowledge/',
    title: 'Knowledge example',
    description: 'See content use a custom presentation outside dashboard UI.',
  },
  {
    href: '/reference/app-api/',
    title: 'Definition reference',
    description: 'Inspect <code>defineView</code> and <code>defineRecipe</code>.',
  },
])}`,
  }),
];
