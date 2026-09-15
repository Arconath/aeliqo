import {cards, checklist, code, definePage, next, note} from './shared.mjs';

export const agentPages = [
  definePage('agents', {
    title: 'Connect an agent',
    description: 'Pair MCP, experimental WebMCP, or a host-supplied model with one authorized application session and Region.',
    body: `<p class="lead">Aeliqo depends on an agent only when your product wants language-driven UI. The framework itself remains deterministic: application code can send the same intent without any model.</p>
<h2>Three standard tools</h2><div class="doc-table"><table><thead><tr><th>Tool</th><th>Purpose</th><th>Cannot do</th></tr></thead><tbody><tr><th><code>aeliqo_context</code></th><td>Discover resources, fields, meanings, views, and actions visible to this session.</td><td>Read undisclosed rows or acquire grants.</td></tr><tr><th><code>aeliqo_render</code></th><td>Submit an intent through validation, evaluation, recipe selection, and Region commit.</td><td>Send HTML, JavaScript, SQL, or module URLs.</td></tr><tr><th><code>aeliqo_act</code></th><td>Preview or request execution of a registered business action.</td><td>Confirm itself or bypass server authorization.</td></tr></tbody></table></div>
<h2>Choose a transport</h2>${cards([{title: 'MCP', body: 'Connect an external agent over a local stdio or HTTP host.', href: '/agents/mcp/', label: 'MCP setup'}, {title: 'BYOK', body: 'Run a bounded model loop in your trusted host process and keep the provider key local.', href: '/agents/byok/', label: 'BYOK setup'}, {title: 'WebMCP', body: 'Use native browser capability detection when available, with manual UI as the fallback.', href: '/agents/webmcp/', label: 'Experimental setup'}])}
${note('What “AI cannot hallucinate UI” means', 'A model may still misunderstand valid language. Aeliqo guarantees that unknown resources, fields, actions, views, functions, stale proposals, over-budget payloads, and unauthorized operations are rejected before execution. It does not guarantee perfect interpretation.', 'boundary')}
<p>If discovery shows that a requested concept is unavailable, the host should allow a truthful <code>no-commit</code> response instead of forcing the model to render unrelated data. The public local runner labels model-only prose as a draft and leaves the current Region unchanged.</p>
${next([{href: '/agents/quickstart/', title: 'Agent quickstart', description: 'Create one paired endpoint and inspect receipts.'}, {href: '/concepts/safety/', title: 'Safety model', description: 'Understand validation and proof boundaries.'}])}`,
  }),

  definePage('agents-quickstart', {
    title: 'Agent quickstart',
    description: 'Expose the three standard tools for one expiring Region session while the same app remains usable manually.',
    body: `<p class="lead">Start after the resource and Region work without AI. The endpoint delegates render calls to the existing app; it does not create a second runtime.</p>
<h2>Create the endpoint</h2>${code('agent.ts', `import {createAppToolEndpoint} from '@aeliqo/agent/app';

const endpoint = createAppToolEndpoint({
  runtime: app.runtime,
  render: app,
  regionId: 'people-main',
  goalEpoch: crypto.randomUUID(),
  transport,
  expiresAt: Date.now() + 15 * 60_000,
  maxPending: 2,
  maxMilliseconds: 15_000,
  maxInputBytes: 32_000,
  maxOutputBytes: 64_000,
});`)}
<h2>Pair trusted state</h2><p>The host chooses the Region, expiry, origin, and current authority. These values are not model arguments. New principal, scope, Region, or goal epochs require a new pairing. By default, discovery exposes only the mounted resource. A host that can route multiple resources may provide <code>context: {read: () =&gt; app.runtime.contexts('people-main')}</code>; the runtime omits denied resources and rejects cross-principal or cross-scope discovery.</p>
<h2>Verify these cases</h2>${checklist(['Context reveals only permitted metadata.', 'A browse intent changes the real Region and returns runtime evidence.', 'Ambiguous language produces a visible choice instead of guessed execution.', 'A form request opens the form but does not perform a write.', 'A denied or stale action is rejected and leaves a recoverable UI.', 'Disconnect, expiry, cancellation, and disposal release pending calls.'])}
${next([{href: '/agents/mcp/', title: 'MCP transport', description: 'Connect stdio or local HTTP.'}, {href: '/agents/byok/', title: 'BYOK model loop', description: 'Keep keys and egress policy in the host.'}])}`,
  }),

  definePage('mcp', {
    title: 'MCP',
    description: 'Connect an MCP client to the bounded Aeliqo endpoint through a trusted local host.',
    body: `<p class="lead">MCP is a communication route from an agent to Aeliqo. The tool handler still uses current host authority, the shared intent compiler, and the existing Region.</p>
<h2>Run the local playground</h2>${code('terminal', `pnpm playground:local
# Open http://127.0.0.1:4174/playground/
# Choose Connected agent → Detect local host → Check connection`)}
<p>The runner prints an HTTP MCP URL, a short-lived local bearer setup, and the complete stdio launch command. Keep that terminal open. The browser acknowledgment is required before either MCP route reports a renderer-ready receipt.</p>
<h2>Supported shapes</h2><p>Use the printed stdio command when the agent launches a child process. Use the printed local HTTP URL and bearer value when the agent connects to the already-running host. Both routes expose exactly <code>aeliqo_context</code>, <code>aeliqo_render</code>, and <code>aeliqo_act</code>. They remain loopback-only; this runner is not a network deployment template.</p>
<h2>Session rules</h2>${checklist(['Pair one agent session to one goal epoch and Region.', 'Reject unknown origins, expired tokens, cross-Region calls, and replay.', 'Limit pending calls, elapsed time, input bytes, output bytes, and tool loops.', 'Propagate cancellation into evaluation, renderer loading, and provider work.', 'Never serialize credentials, private row payloads, or host confirmation callbacks into discovery.'])}
<h2>Client verification</h2><p>Test with a real MCP protocol client: initialize, list exactly three tools, call context, render a valid intent, reject an unknown field, then disconnect while work is pending.</p>
${next([{href: '/agents/recovery/', title: 'Recovery', description: 'Handle expiry, disconnect, stale proposals, and uncertain actions.'}, {href: '/playground/', title: 'Playground', description: 'Use the same Region manually while no MCP host is connected.'}])}`,
  }),

  definePage('webmcp', {
    title: 'WebMCP (experimental)',
    description: 'Detect native browser support and register bounded tools only when the current browser exposes the required capability.',
    body: `<p class="lead">WebMCP availability depends on browser implementation and release channel. Aeliqo reports <em>available</em>, <em>unavailable</em>, or <em>connected</em>; it does not display a mock connection as real.</p>
<h2>Progressive enhancement</h2>${code('capability.ts', `import {detectWebMcp, registerWebMcpTools} from '@aeliqo/agent/webmcp';

const capability = detectWebMcp();
if (capability.supported) {
  const registration = await registerWebMcpTools({endpoint});
  // Retain registration.value.adapter and close it with the session.
} else {
  showManualControls();
}`)}
<h2>Required fallback</h2><p>The same resource must remain fully usable through buttons, filters, forms, and routes. Native registration is an optional communication surface, not a dependency for rendering or authorization.</p>
${note('Experimental status', 'Simulated protocol tests and native browser availability are recorded separately. Do not describe simulation as native support or readiness.', 'warning')}
${next([{href: '/agents/', title: 'Agent overview', description: 'Compare MCP, BYOK, and WebMCP.'}, {href: '/guides/adaptive-region/', title: 'Manual Region path', description: 'Keep the full interface functional without an agent.'}])}`,
  }),

  definePage('byok', {
    title: 'Bring your own model',
    description: 'Run the provider SDK and bounded tool loop in a trusted host process without sending keys to the public playground.',
    body: `<p class="lead">BYOK is a host integration. Aeliqo projects the same three tools to the model; your application owns provider choice, credentials, egress policy, cost, retention, and user disclosure.</p>
<h2>Configure the local process</h2>${code('terminal', `cp apps/playground/.env.example apps/playground/.env.local
# Edit .env.local with your tool-capable endpoint, model, and key.
pnpm playground:local`)}
${code('apps/playground/.env.local', `AELIQO_MODEL_BASE_URL=https://your-provider.example/v1/
AELIQO_MODEL=your-tool-capable-model
AELIQO_MODEL_API_KEY=your-local-secret`)}
<p>Open the printed playground URL, choose <strong>Connected agent</strong>, detect the local host, and send a prompt. The composer stays disabled when the three variables are missing. Plain HTTP model endpoints are rejected except an explicitly opted-in loopback endpoint.</p>
<h2>Host boundary</h2>${checklist(['Read the API key only in the local or server process.', 'Allow-list provider endpoint and model; never accept either from agent tool arguments.', 'Disclose which metadata or rows may leave the application.', 'Bound turns, tool calls, retries, time, and bytes.', 'Record provider/model/test conditions for live acceptance without storing prompts or credentials by default.'])}
<h2>Browser communication</h2><p>The runner serves the same public playground build and pairs one expiring browser Region over a same-origin event stream. A tool result is acknowledged by that browser before the local process can report renderer-ready. Disconnect and reset cancel pending work and dispose the pairing.</p>
${note('No hosted inference', 'The 0.3 public architecture does not require a hosted relay, account, billing system, or centralized conversation storage.')}
${next([{href: '/agents/recovery/', title: 'Recovery and limits', description: 'Handle provider failure, ambiguity, and disconnect safely.'}, {href: '/concepts/safety/', title: 'Data egress', description: 'Separate metadata discovery from record disclosure.'}])}`,
  }),

  definePage('agent-recovery', {
    title: 'Agent recovery',
    description: 'Keep the application understandable when language is ambiguous, the provider fails, the session expires, or an action outcome is uncertain.',
    body: `<h2>Ambiguous intent</h2><p>Return <code>needs-input</code> with bounded choices such as the intended period, resource, or action. Show the proposed filters and target view so the user can inspect the interpretation.</p>
<h2>Provider or transport failure</h2><p>Preserve the last still-authorized UI, explain that the connection failed, and keep manual controls available. Stop repeated failures that provide no new information.</p>
<h2>Expired or revoked pairing</h2><p>Reject the call, cancel in-flight work, clear any now-unauthorized Region data, and require the trusted host to pair again.</p>
<h2>Uncertain write</h2><p>If a remote write may have occurred, display an ambiguous receipt and a host-defined reconciliation action. Never report cancellation as rollback or automatically retry a non-idempotent write.</p>
<h2>Truthful UI copy</h2>${checklist(['“UI updated” appears only after the matching runtime/renderer receipt.', 'Displayed numeric summaries are derived from Result evidence.', 'Model prose is not promoted to application fact.', 'The inspector shows intent, compiled Task, Result descriptor, selected view, and diagnostics—not chain-of-thought.'])}
${next([{href: '/reference/diagnostics/', title: 'Diagnostics', description: 'Map outcomes to actionable recovery.'}, {href: '/ship/', title: 'Ship checklist', description: 'Verify manual and connected journeys together.'}])}`,
  }),
];
