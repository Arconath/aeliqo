import {definePage, next, note} from './shared.mjs';

export const secondaryPages = [
  definePage('about', {
    title: 'About Aeliqo',
    description: 'An open-source framework for adaptive, application-controlled interfaces with optional agent communication.',
    body: `<p class="lead">Aeliqo connects application-owned meaning and authority to registered UI. It exists to make adaptive, agent-connected products easier to build without giving a model control of code or permissions.</p>
<h2>Open-source boundary</h2><p>Core contracts, runtime, web components, React bindings, agent adapters, and developer tooling use the repository license. The framework works without a hosted account, inference relay, or license server.</p>
<h2>Product boundary</h2><p>Your application remains responsible for authentication, server authorization, source access, routes, business actions, provider policy, and operations. Aeliqo is infrastructure inside that product—not the product’s backend.</p>
${next([{href: '/', title: 'Documentation', description: 'Understand the 0.3 application path.'}, {href: 'https://github.com/Arconath/aeliqo', title: 'Source', description: 'Review implementation and contribute.'}])}`,
  }),
  definePage('license', {
    title: 'License',
    description: 'Aeliqo framework code and local tooling use Apache-2.0.',
    body: `<p class="lead">Review the repository license and third-party notices for controlling terms.</p><h2>Covered surface</h2><p>The published framework packages, local examples, tests, and developer tooling follow the repository license. Future hosted services may define a separate service agreement, but the open-source runtime does not depend on a license network service or hosted account.</p><p><a href="https://github.com/Arconath/aeliqo/blob/main/LICENSE">Read the repository license →</a></p>`,
  }),
  definePage('privacy', {
    title: 'Privacy',
    description: 'How the public documentation and synthetic playground handle data.',
    body: `<p class="lead">The public playground is designed to run synthetic data without a model provider.</p><h2>Local state</h2><p>Filtering and evaluation run in the browser. Guided and manual demo state is local to the session and can be reset. Exports must never include provider keys or private records.</p><h2>Optional analytics</h2><p>If production analytics are enabled, the site asks before loading them. Aggregate events exclude form content, URL query parameters, credentials, and direct identity.</p><h2>Connected agents</h2><p>MCP or BYOK requires a user-run host. That host must disclose provider egress and retain keys only in the trusted process. Native WebMCP follows browser capability and policy.</p><h2>External links</h2><p>Opening GitHub, npm, or another external service sends a request to that destination.</p>`,
  }),
  definePage('security', {
    title: 'Security',
    description: 'Understand the application trust boundary and report sensitive issues privately.',
    body: `<p class="lead">Aeliqo validates typed proposals and current contract state. The integrating application remains responsible for authenticated identity, source authorization, route protection, and business execution.</p><h2>Report a vulnerability</h2><p>Do not post credentials, customer records, or exploit details in a public issue. Use <a href="https://github.com/Arconath/aeliqo/security/advisories/new">GitHub private vulnerability reporting</a>.</p><h2>Useful evidence</h2><p>Include the exact version and entry point, smallest non-sensitive reproduction, expected boundary, observed behavior, and impact.</p>${note('No published SLA', 'The open-source project does not publish a monitored security email address or response-time SLA. The private advisory is the supported sensitive-reporting route.', 'warning')}`,
  }),
  definePage('support', {
    title: 'Support',
    description: 'Report reproducible issues against an exact package version and host environment.',
    body: `<p class="lead">The public repository is the support and collaboration surface.</p><h2>Before filing</h2><p>Confirm every Aeliqo package uses the same exact version, reduce the issue to a minimal fixture, and check the relevant guide, component page, diagnostics, and release notes.</p><h2>Include</h2><p>Share exact package, browser, framework, runtime, and provider versions; expected and actual behavior; a diagnostic code; and non-sensitive reproduction steps.</p><h2>Service boundary</h2><p>The open-source project does not promise a response time or commercial support agreement.</p><h2>Sensitive reports</h2><p>Use <a href="/legal/security/">private vulnerability reporting</a>, not a public issue.</p>`,
  }),
];
