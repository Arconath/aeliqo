import { checklist, definePage, next, note } from './shared.mjs';

export const understandPages = [
  definePage('concepts', {
    title: 'How Aeliqo works',
    description:
      'Follow one intent through Catalog, Task, Result, Recipe, Experience, and Region without treating model output as UI code.',
    body: `<p class="lead">Aeliqo separates what the user wants from how a registered interface presents it. Each stage narrows behavior and attaches evidence.</p>
<ol class="concept-flow"><li><span>01</span><div><h3>Resource and Catalog</h3><p>Describe entities, fields, stable identity, relationships, meanings, and available operations.</p></div></li><li><span>02</span><div><h3>Intent</h3><p>A bounded request such as browse People, inspect one Product, edit a Ticket, or analyze a registered measure.</p></div></li><li><span>03</span><div><h3>Task</h3><p>The pure compiler turns intent into required outputs, operations, fields, form bindings, and optional presentation preference.</p></div></li><li><span>04</span><div><h3>Result</h3><p>Evaluation returns rows plus identity, scope, grain, precision, completeness, lineage, and revision.</p></div></li><li><span>05</span><div><h3>Recipe and Experience</h3><p>Registered policy selects a view that satisfies the Task, environment, accessibility, and host constraints.</p></div></li><li><span>06</span><div><h3>Region commit</h3><p>The runtime rechecks authority and read revisions, transfers valid state, and commits or keeps the previous safe UI.</p></div></li></ol>
${next([
  {
    href: '/concepts/intent/',
    title: 'Intent contract',
    description: 'See the six standard intents and extension path.',
  },
  { href: '/concepts/safety/', title: 'Safety model', description: 'Understand the non-bypassable validation gates.' },
])}`,
  }),

  definePage('intent', {
    title: 'Intent',
    description: 'A small, validated request that application code and agents can both send through the same pipeline.',
    body: `<p class="lead">Intent says what outcome is needed, not how to construct HTML. It may name a registered view preference, but it cannot install or implement that view.</p>
<h2>Standard intents</h2><div class="doc-table"><table><thead><tr><th>Kind</th><th>Purpose</th></tr></thead><tbody><tr><th><code>browse</code></th><td>Collection, search, filter, sort, and pagination.</td></tr><tr><th><code>detail</code></th><td>One identified entity or content item.</td></tr><tr><th><code>create</code></th><td>Open a registered creation form.</td></tr><tr><th><code>edit</code></th><td>Open a registered edit form for current host-supplied state.</td></tr><tr><th><code>compare</code></th><td>Compare identified entities or values.</td></tr><tr><th><code>analyze</code></th><td>Aggregate registered meanings at a valid grain and temporal policy.</td></tr></tbody></table></div>
<h2>Envelope boundary</h2><p>Intent may include resource, fields, filters, sort, page, identities, registered measures, period, and <code>preferredView</code>. It never includes principal, grants, credentials, executable code, SQL, HTML, endpoint URLs, or module paths.</p>
<h2>Custom intent</h2><p>Register a namespaced version, runtime input schema, capability list, and pure synchronous compiler. The produced Task passes the same schema, catalog, Region, and authority validation as a standard intent.</p>
${note('Valid does not mean correctly interpreted', 'A model can choose the wrong but schema-valid filter or period. Keep material choices visible and return <code>needs-input</code> when ambiguity changes the outcome.', 'warning')}
${next([
  { href: '/reference/intent-schema/', title: 'Intent schema', description: 'Inspect fields and validation behavior.' },
  { href: '/guides/custom-views/', title: 'Extensions', description: 'Add custom behavior without enlarging core.' },
])}`,
  }),

  definePage('semantics', {
    title: 'Semantic contracts',
    description:
      'Separate technical field types from business definitions, units, aggregation, grain, and temporal policy.',
    body: `<p class="lead">Semantic metadata stops a valid-looking query from making an invalid claim. “Number” is not enough to decide sum, average, ratio, currency, precision, or trend.</p>
<h2>What a Result must preserve</h2>${checklist(['Stable entity identity and authorized population scope.', 'Row or aggregation grain.', 'Unit, precision, null behavior, and completeness.', 'Temporal field, calendar, timezone, and bucket grain when applicable.', 'Catalog, source, policy, and Result revisions.', 'Lineage from registered meaning and query operations.'])}
<h2>Example: absence rate</h2><p>Absence days can be summed. Absence rate is a ratio with a defined numerator, denominator, population, period, and precision. Aeliqo accepts analysis only when the requested meaning and grain are registered and compatible.</p>
<h2>Missing and partial data</h2><p>Null is not zero. Partial is not exact. Sampled is not complete. The Result contract keeps these distinctions available to the recipe so the UI cannot silently overstate evidence.</p>
${next([
  {
    href: '/guides/resources/',
    title: 'Resource metadata',
    description: 'Declare field roles and connect an existing Catalog.',
  },
  { href: '/concepts/safety/', title: 'Semantic validation', description: 'See how invalid operations are rejected.' },
])}`,
  }),

  definePage('state-ownership', {
    title: 'Selection, draft, and focus ownership',
    description: 'Preserve user work during adaptation by assigning each piece of interaction state one clear owner.',
    body: `<p class="lead">Responsive UI is safe only when view changes preserve the state a person needs to continue the task.</p>
<h2>State map</h2><div class="doc-table"><table><thead><tr><th>State</th><th>Default owner</th><th>Transfer rule</th></tr></thead><tbody><tr><th>Filters and sort</th><td>Intent/application</td><td>Persist across equivalent browse views.</td></tr><tr><th>Selection</th><td>Region using stable identity</td><td>Transfer only when the next view supports equivalent identity.</td></tr><tr><th>Form draft</th><td>Form recipe or host, never both</td><td>Block or map transitions that would lose dirty values.</td></tr><tr><th>Focus</th><td>Active renderer</td><td>Restore the logical control after commit; do not steal focus during typing.</td></tr><tr><th>Navigation context</th><td>Host router plus Region</td><td>Retain back context when master-detail becomes stacked navigation.</td></tr></tbody></table></div>
<h2>Transition guards</h2><p>Coalesce resize changes and defer adaptation during IME composition, active typing, drag, confirmation, or unsafe dirty-draft transitions. If mapping fails, keep the current valid view.</p>
${next([
  {
    href: '/guides/responsive-behavior/',
    title: 'Responsive policy',
    description: 'See view choices by task and container.',
  },
  { href: '/guides/forms/', title: 'Form UX', description: 'Keep draft and validation ownership explicit.' },
])}`,
  }),

  definePage('safety', {
    title: 'Safety infrastructure',
    description:
      'Make invalid, stale, unauthorized, and over-budget proposals non-executable while keeping limitations visible.',
    body: `<p class="lead">Aeliqo’s safety claim is structural: runtime boundaries reject proposals that do not satisfy registered contracts and current authority. It is not a promise that a language model always understands the user.</p>
<h2>Non-bypassable pipeline</h2><ol class="doc-steps"><li><span>1</span><div><h3>Parse</h3><p>Treat every ingress as unknown and validate a bounded intent schema.</p></div></li><li><span>2</span><div><h3>Authorize</h3><p>Read principal, scope, policy, grants, and limits from the trusted host.</p></div></li><li><span>3</span><div><h3>Compile and evaluate</h3><p>Use only registered fields, meanings, functions, operations, and data services.</p></div></li><li><span>4</span><div><h3>Present</h3><p>Select only registered recipes and views compatible with the Result and Experience.</p></div></li><li><span>5</span><div><h3>Recheck and commit</h3><p>Reject stale read sets or revoked authority before replacing the Region.</p></div></li></ol>
<h2>Always rejected</h2>${checklist(['Unknown resource, field, action, view, meaning, or function.', 'Principal, grants, credentials, executable code, HTML, JavaScript, SQL, network endpoint, or import path from an agent.', 'Cross-session or cross-Region invocation.', 'Stale Catalog, Result, source, policy, entity, or presentation revision.', 'Payload or loop that exceeds configured limits.', 'Agent-created confirmation for a protected action.'])}
<h2>Data egress</h2><p>Context discovery sends only allowed metadata by default. Records or detailed Results leave the application for a model only when a separate host egress policy allows it. Prompt injection inside records cannot add grants or install code.</p>
<h2>Truth boundary</h2><p>“Renderer ready” means the runtime evidence committed and the renderer accepted the plan. It does not prove pixels were painted or the user noticed them. Numeric claims shown by the app come from Result evidence; arbitrary model prose remains prose.</p>
${next([
  {
    href: '/agents/recovery/',
    title: 'Agent recovery',
    description: 'Turn failures and ambiguity into understandable user choices.',
  },
  { href: '/reference/diagnostics/', title: 'Diagnostics', description: 'Map stable codes to recovery.' },
])}`,
  }),
];
