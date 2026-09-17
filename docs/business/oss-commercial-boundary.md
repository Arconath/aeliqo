# OSS and commercial boundary

## Shipped as Apache-2.0 source

Aeliqo's core contracts, evaluator, runtime, HTTP and local data paths, complete
component catalog, React bindings, agent and protocol plumbing, security and
accessibility behavior, and internal testkit source are Apache-2.0. The five
public packages are `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`,
`@aeliqo/react`, and `@aeliqo/agent`. The testkit stays a private workspace so
its release-only helpers are not mistaken for another public API.

These capabilities run without a license server, account callback, hosted
control plane, paid row limit, or mandatory model call. Applications may use
local records and the local evaluator entirely offline. HTTP data sources, MCP,
and BYOK providers are optional host-configured effects; their network use is a
property of that chosen integration, not a framework licensing dependency.

Security, authorization hooks, accessibility behavior, and the required
component families are not paid upgrades. A configured local application keeps
working when a future hosted service is unavailable.

`@aeliqo/runtime/audit` supplies the basic local audit export: a bounded,
in-memory collector for fixed plan, capability, cancellation, source, cache,
renderer, and resource event families. It rejects arbitrary messages, prompts,
records, identity fields, URLs, and unknown properties, and discloses when its
count or byte ceiling evicts older records. The application owns collector
scoping, persistence, transport, access control, and any longer retention. The
runtime performs no audit network or filesystem I/O.

## Separate commercial hypothesis

A future commercial service may operate cross-organization collaboration,
catalog and profile rollout, approval workflows, management SSO/SCIM, retained
audit search, fleet diagnostics, managed infrastructure, private deployment,
and support/SLA. It would consume the same public contracts and live in a
separate service and license boundary.

No hosted commercial service, price, SLA, customer demand, recurring revenue,
or product-market fit is claimed for 0.4.0. Those are hypotheses to validate in
paid pilots. Any future pricing should separate inference, storage, egress, and
support costs; BYOK must not be charged again as bundled inference, and ordinary
rendering must not be metered.

## Release evidence

Source builds and clean tarball consumers demonstrate offline framework use.
Registry publication and website deployment must be verified against the same
release revision. See the [0.3 to 0.4 migration guide](../site/pages/migration-0.3.md).
