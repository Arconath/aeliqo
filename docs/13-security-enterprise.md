# 13 — Security, tenancy and enterprise operation

## Threat model

Untrusted inputs include natural language, model tool arguments, source records, catalog descriptions from external services, imported schemas, saved workspace documents, HTTP streams, extension configuration and user-authored expressions. Trusted code includes reviewed built components/functions and application-owned executor/action implementations. Client-side validation is UX and defense-in-depth, not the backend authorization boundary.

Primary threats: prompt injection causing unauthorized discovery/query/action, expression/query resource exhaustion, cross-tenant cache/handle leakage, source-description injection, sensitive data in logs/model context, renderer XSS, arbitrary URL/module execution, stale authorization after a plan was approved, and accidental destructive actions during view changes.

## Authorization

Discovery is scoped to the principal, not a global schema dump. Server execution rechecks row/field/action permissions and dependencies of derived metrics. Return typed denied/unsupported responses without revealing inaccessible field names or values. Do not treat a client-provided organization or workspace identifier as proof of membership.

Policy has version/digest. Cache/result/query handles bind tenant, principal or an explicitly safe share scope, policy version, source scope and catalog definitions. Revocation invalidates leases and aborts outstanding requests. Tests must show identical queries from two tenants cannot share unauthorized cached results.

## Model and tool boundaries

Models receive bounded authorized metadata and only the minimum results needed for interpretation. Raw source descriptions/records are quoted/delimited as data, never injected as instructions. A model sees tool schemas from the same runtime contracts; it cannot call arbitrary SQL/HTTP/JS or publish a semantic definition outside its allowed scope.

MCP authorization follows the supported protocol's official requirements, including audience-bound tokens rather than token passthrough. Use the official SDK and validate the installed protocol version. WebMCP annotations are hints, not access control. [S15, S16]

## Expression and query safety

Bound AST depth/node count, literal sizes, joins, projection width, group cardinality, row/byte/scan count, concurrency, time and worker memory. No `eval`, Function constructors, arbitrary regular expressions or unbounded recursion. Function registry is trusted build-time code with resource declarations. Normalize and validate before hashing/caching.

No arbitrary remote URL fetch from agent payloads. HTTP sources use application-configured origins and allowed endpoints; server fetch implementations enforce SSRF controls appropriate to the deployment. Generated SQL, when used by the host, is parameterized and compiled from accepted identifiers/operators.

## Rendering safety

Native templates escape text; no user/agent HTML injection. Trusted local rich-text rendering uses an explicit sanitizer/allowlist and separate API, never a general raw HTML wire field. Links allow safe schemes and application navigation contracts. Extension modules are build-time allowlisted; no remote loader URL in an experience manifest.

CSS customization uses tokens/parts/approved profiles. Do not accept executable style expressions. Shadow DOM is style encapsulation, not a security sandbox.

## Actions and approvals

Business changes have separate input schema, side-effect classification, authorization, confirmation policy, idempotency key and entity revision. Recheck permissions immediately before execution. A cancelled or uncertain action returns an ambiguous receipt requiring inspection; do not blindly retry. UI undo and domain compensation are not interchangeable.

Human confirmation cannot be bypassed by selecting a more permissive tool path. Define-with-AI cannot self-approve a shared business rule unless the application explicitly permits that low-risk scope. A valid syntax/preview is not a guarantee of fairness/correctness for employment, health, credit or other consequential decisions.

## Enterprise scale without enterprise-only safety

All isolation interfaces, validation, local audit events, redaction, cancellation, result limits, source auth hooks and accessibility remain OSS. A managed service may sell central policy administration, SSO for the management console, long-retention tamper-evident audit storage, approvals across teams and support. Local applications must still be able to enforce their existing auth without buying Aeliqo Cloud.

Runtime instances are isolated per SSR request/user region. Avoid a globally mutable registry carrying user state. Stateless HTTP workers can scale horizontally using application-backed result/query storage where needed. Do not introduce a distributed control plane into the browser runtime.

## Observability

Emit typed low-cardinality events for plan latency, rejected capabilities, cancellations, source errors, cache hit/miss, renderer status and resource counts. `@aeliqo/runtime/audit` is the basic OSS local export: an in-memory collector with closed event shapes, count/byte budgets, explicit dropped-history disclosure and no I/O. It rejects arbitrary messages, records, prompts, credentials, URLs, identity fields and unknown properties. Applications own collector scoping, access, persistence and transport; host integrations map source detail to stable codes. Managed retention/cross-team analytics may be paid. Sensitive debugging, if a host adds it separately, requires explicit opt-in and must not be routed through the basic exporter.

Trace spans connect request, plan, result and region revisions without exposing a model's private reasoning. Error budgets measure failed user tasks and experience regressions, not just server uptime.

## Supply chain

Pinned lockfile, dependency provenance/license inventory, secret scanning, artifact SBOM, package content review, trusted npm publishing where supported, and signed/digested release artifacts. Do not execute third-party install scripts in production credentials context. CI jobs use minimum permissions, isolated workloads and pinned action revisions established in M0.

## Acceptance

Threat-driven tests include hidden field discovery, cross-principal handle reuse, query cancellation after permission revocation, hostile source text, oversized stream/AST, prototype-pollution-like keys, XSS links/content, unsafe metric publication, action confirmation bypass, source SSRF, replayed write and failure after partial action completion. Security review is a release gate, not a sales feature.

## Master consolidation inference, approval and cross-boundary leakage

The trusted transport context owns actor/principal, confirmation receipts and operation budgets. Those fields are not caller-settable authority. Recheck policy at commit and model-egress boundaries, not only at initial discovery. Cache isolation includes permission-dependent output metadata and plan acceptances, not just record arrays.

For approved aggregate-only host outputs, avoid simplistic client inference of authorization from dependency visibility. The host may allow an aggregate without raw-row disclosure; it must provide a distinct authorized capability. Arbitrary client expressions cannot declassify hidden inputs. Conversely an output's visibility to the human does not imply permission to send it to an external model.

Bound exploratory query count and explanations to prevent accidental sensitive inference amplification. A source may apply minimum-group suppression or other domain privacy policy; suppressed is neither zero nor null-with-no-explanation. Such policies are application-defined and enforced server-side. Do not claim differential privacy without actually implementing and evaluating it.

Repository permissions, browser privileges and business-action permissions are separate. Agent development harness must not disable security/sandbox prompts to finish release. See primary OWASP and MCP source notes in the research update; instructions alone are not an injection barrier.
