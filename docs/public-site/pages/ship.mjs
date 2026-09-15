import { checklist, definePage, next, note, source } from './shared.mjs';
import { RELEASE_VERSION } from '../../../scripts/release/metadata.mjs';

export const shipPages = [
  definePage('ship', {
    title: 'Ship an Aeliqo application',
    description:
      'Verify contracts, authority, interaction, accessibility, framework integration, agent behavior, and clean installation before release.',
    body: `<p class="lead">Readiness belongs to the final application composition. Passing a component scanner or unit test does not prove the whole journey.</p>
<h2>Contract and data</h2>${checklist(['Invalid and unknown intent fields, actions, views, schema versions, and duplicate registrations fail closed.', 'Missing/null, units, decimals, timezones, aggregation, grain, identity, partial data, and stale revisions are exercised.', 'Local and remote source limits, pagination, cancellation, and cleanup behave under failure.', 'A custom view and custom intent compile from consumer code without a core patch.'])}
<h2>Authority and actions</h2>${checklist(['Principal or scope changes during query, renderer load, and commit cannot expose or retain forbidden data.', 'Cross-session and cross-Region calls, replay, expired pairing, and late results are rejected.', 'Required confirmation cannot be issued by an agent.', 'Writes have entity revision and idempotency policy; uncertain completion has reconciliation and no unsafe retry.'])}
<h2>UI and accessibility</h2>${checklist(['Test supported browser journeys at 320, 360, 768, and 1280 CSS pixels.', 'Exercise keyboard, focus restoration, 200% text, 400% reflow, forced colors, reduced motion, RTL, long text, and dirty drafts.', 'Perform screen-reader review for browse, detail, form error, confirmation, and recovery.', 'Review screenshots after implementation; scanner output alone is not a WCAG certification.'])}
<h2>Docs and developer experience</h2>${checklist(['Install from release tarballs in a clean consumer with no workspace aliases.', 'Complete quickstart using only the published docs and compiled snippet.', 'Verify every import, event, styling hook, error example, link, search result, and exported project.', 'Prove 0.1 to 0.3 migration against a real 0.1 consumer.'])}
${note('Publication stays last', 'Do not publish npm packages or promote the production site until the exact source revision passes the complete readiness gate. Package publication is not atomic; a partial publish must not promote the website.', 'warning')}
${next([
  { href: '/ship/ssr/', title: 'SSR and hydration', description: 'Verify request isolation and browser registration.' },
  {
    href: '/ship/browser-support/',
    title: 'Browser support',
    description: 'See the qualification matrix and fallback rules.',
  },
  { href: '/ship/migration-0.1/', title: 'Migration', description: 'Upgrade existing low-level integrations.' },
])}`,
  }),

  definePage('ssr', {
    title: 'SSR and hydration',
    description: 'Render server-safe output without DOM access at module evaluation or cross-request runtime state.',
    body: `<h2>Server boundary</h2><p>Use <code>@aeliqo/web/server</code> for server rendering and keep browser registration inside a client entry. Serialize initial data as separately escaped JSON, not interpolated HTML.</p>
<h2>Request isolation</h2>${checklist(['Create authority and runtime state per request or explicit application security context.', 'Never store principal, ResultStore, Region, or action confirmation in a process-wide singleton.', 'Abort downstream source work when the request ends.', 'Do not import provider SDKs or browser-only registration into the server-rendered component path.'])}
<h2>Hydration order</h2><p>Load <code>@lit-labs/ssr-client/lit-element-hydrate-support.js</code> before dynamically importing <code>@aeliqo/web/app</code> or registering Aeliqo elements. Loading a Lit element class first can cause the declarative shadow tree to be replaced instead of hydrated.</p>
<h2>Hydration checks</h2>${checklist(['Declarative shadow roots hydrate without duplicate nodes or listeners.', 'Existing input and dirty draft values are not reset.', 'Focus order and form association remain correct.', 'A no-JavaScript or failed-hydration fallback stays readable and honest.', 'Server and browser packages use the same exact version.'])}
${next([
  {
    href: '/start/frameworks/',
    title: 'Framework setup',
    description: 'Integrate React, Vue, Vanilla, or custom-element hosts.',
  },
  {
    href: '/reference/packages/',
    title: 'Entry points',
    description: 'Keep browser and server dependencies separated.',
  },
])}`,
  }),

  definePage('browser-support', {
    title: 'Browser support',
    description:
      'Separate required web-platform behavior, verified journey coverage, and experimental WebMCP availability.',
    body: `<p class="lead">The 0.3 release gate covers current Chromium, Firefox, and WebKit engines for promised journeys. The release notes record the exact tested versions when the candidate is qualified.</p>
<h2>Required platform</h2><p>Custom Elements, Shadow DOM, modules, <code>AbortController</code>, <code>ResizeObserver</code>, and modern CSS are required. SSR consumers use server-safe entry points and hydrate in a capable browser.</p>
<h2>Progressive behavior</h2><p>Reduced motion and forced colors adapt through media features. Touch, hover, keyboard, locale, direction, and container size are treated as environment evidence rather than user-agent guesses.</p>
<h2>WebMCP</h2><p>Native WebMCP is experimental and is never part of baseline browser support. The interface reports unavailable when the capability does not exist and keeps guided demo and manual controls functional.</p>
${note('Qualification status', 'Performance targets are intentionally deferred for this release plan. Functional resource limits, cancellation, cleanup, lazy imports, and dependency separation remain mandatory; no unmeasured latency claim is made.')}
${next([
  { href: '/agents/webmcp/', title: 'WebMCP', description: 'Implement capability detection and manual fallback.' },
  { href: '/ship/', title: 'Release gate', description: 'Review the full browser and accessibility matrix.' },
])}`,
  }),

  definePage('migration', {
    title: 'Migrate from 0.1 to 0.3',
    description:
      'Replace repeated low-level evaluator, store, Region, and tool wiring with the public application facade.',
    body: `<p class="lead">0.3 intentionally breaks the happy path so common applications stop constructing internal Task, ResultHandle, PresentationPlan, stage, commit, and observer plumbing.</p>
<h2>Package mapping</h2><p>The six public package names remain. Add the new <code>/app</code> and <code>/recipes</code> entry points where appropriate and keep every dependency on exact <code>${RELEASE_VERSION}</code>.</p>
<h2>Migration sequence</h2><ol class="doc-steps"><li><span>1</span><div><h3>Capture 0.1 behavior</h3><p>Record current journeys, authority checks, actions, routes, states, and accessible interaction before changing imports.</p></div></li><li><span>2</span><div><h3>Define resources</h3><p>Move runtime schema, identity, field meaning, forms, and allowed views into <code>defineResource</code>.</p></div></li><li><span>3</span><div><h3>Bind data and authority</h3><p>Reuse the existing DataService and replace duplicated authority callbacks with one trusted adapter.</p></div></li><li><span>4</span><div><h3>Create the facade</h3><p>Replace hand-built compiler/evaluator/store/Region/presentation wiring with <code>createAeliqoApp</code>.</p></div></li><li><span>5</span><div><h3>Send intent</h3><p>Replace scenario-specific Tasks and view selectors with standard or registered custom intents.</p></div></li><li><span>6</span><div><h3>Pair agents</h3><p>Replace broad capability lists with the three standard tools around the existing Region.</p></div></li></ol>
<h2>Removed assumptions</h2>${checklist(['Scenario IDs no longer choose a view outside adaptive policy.', 'Agent payloads cannot contain authority or executable presentation.', 'Compatibility aliases and obsolete 0.1 happy-path helpers are removed after consumers migrate.', 'Renderer-ready is no longer described as proof of browser paint.', 'Studio is not part of the 0.3 public journey.'])}
<h2>Before: direct 0.1 presentation wiring</h2><p>This compiled fixture owns the table choice, rows, and responsive behavior directly.</p>${source('examples/migration-0.1/before.ts', 'examples/migration-0.1/before.ts')}
<h2>After: the 0.3 application facade</h2><p>The migrated fixture registers the same People identity and fields, then sends a browse intent. Aeliqo selects the permitted table or cards recipe from container evidence.</p>${source('examples/quickstart/src/app.ts', 'examples/quickstart/src/app.ts')}
<h2>Verify equivalence</h2><p>Run manual and agent intents against the same resource, compare Result evidence and visible behavior, then test stale revisions, revocation, cancellation, form draft, navigation, and action idempotency.</p>
${note('Evidence in this release gate', 'The migration consumer installs the published 0.1.0 packages, builds the direct-table fixture, installs current package tarballs in a second clean directory, builds the facade fixture, and records both lockfile digests. It does not use workspace aliases.')}
${next([
  { href: '/0.1/', title: '0.1 archive', description: 'Review the previous release boundary.' },
  {
    href: '/start/existing-app/',
    title: 'Existing app integration',
    description: 'Adopt the facade one Region at a time.',
  },
])}`,
  }),

  definePage('release-notes', {
    title: '0.3 release notes',
    description:
      'The application facade, bounded intent contract, adaptive recipes, three agent tools, and public site separation delivered for 0.3.',
    body: `<h2>Highlights</h2>${checklist(['Resource definitions combine runtime schema, identity, semantic metadata, forms, and allowed views.', 'One intent compiler supports browse, detail, create, edit, compare, analyze, and registered custom intents.', 'Runtime and web application facades own the complete Region lifecycle.', 'Standard recipes adapt across container conditions without a model call.', 'Agent integration exposes exactly context, render, and action tools for one paired Region.', 'Landing, documentation, and playground have distinct canonical hosts and purposes.'])}
<h2>Breaking changes</h2><p>The recommended developer path moves from low-level Task and presentation plumbing to resource/data/authority configuration plus intent. Exact removals are finalized only after clean consumers and the migration fixture pass.</p>
<h2>Status</h2><p>This documentation describes the 0.3 contract. A release is not considered ready until the candidate commit passes installation, journey, documentation, accessibility, security, migration, package-integrity, and production-route verification.</p>
${next([
  { href: '/ship/migration-0.1/', title: 'Migration guide', description: 'Upgrade a 0.1 integration.' },
  { href: '/ship/', title: 'Readiness gate', description: 'See what must pass before publication.' },
])}`,
  }),

  definePage('archive-0.1', {
    title: 'Aeliqo 0.1 documentation archive',
    description: 'Archived release boundary and migration material for applications that have not moved to 0.3.',
    body: `<p class="lead">0.1 remains published and is not deleted or overwritten. This archive is read-only; the default documentation follows the active 0.3 contract.</p>
<h2>Archived material</h2><ul><li><a href="https://github.com/Arconath/aeliqo/blob/main/docs/public/0.1.0-support-boundary.md">0.1 support boundary</a></li><li><a href="https://github.com/Arconath/aeliqo/blob/main/docs/migration-0.1.0.md">Historical 0.1 migration document</a></li><li><a href="https://www.npmjs.com/org/aeliqo">Published package versions</a></li></ul>
${note('Do not mix release lines', 'Keep all six packages on one exact version. The 0.3 facade and intent examples do not apply to a 0.1 installation.', 'warning')}
${next([
  { href: '/ship/migration-0.1/', title: 'Move to 0.3', description: 'Follow the application-facade migration.' },
  { href: '/start/', title: '0.3 quickstart', description: 'Build the current supported path.' },
])}`,
  }),
];
