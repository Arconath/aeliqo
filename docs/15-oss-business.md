# 15 — OSS-to-business boundary

## Product thesis

Win adoption through a complete, trustworthy framework that makes data-driven UI cheaper to build and easier to govern. Sell the organizational cost of operating it across teams, not basic correctness. This is a business hypothesis requiring external adoption/paid validation, not proven product-market fit.

## OSS, Apache-2.0

Core contracts/planners/expressions, application data contract and local/HTTP implementation, runtime, all declared v0.1.0 components and 2D visualizations, thin framework binding, MCP/WebMCP/BYOK capability plumbing, basic local Studio/Devtools, conformance kit, security/auth integration hooks, accessibility, themes and public documentation.

No artificial row/region/user quota inside the OSS library. Performance/resource budgets are transparent configuration for safety, not billing gates. No runtime “phone home” or license-check requirement. Offline/self-hosted use of OSS remains possible. Existing Apache-2.0 rights are not revoked by a future paid offering. [S17]

## Paid service / separate private repository

Managed collaborative Studio; synchronized shared catalogs and profiles; organization approval workflows and audit retention; semantic/profile rollout management across applications; management-console SSO/SCIM; managed secrets/infrastructure; policy dashboards and fleet diagnostics; private managed deployment; enterprise support/SLA, training and migration services.

The **interfaces** needed to integrate existing customer security stay OSS. A future paid SSO capability would apply to Aeliqo's management service, not withhold authentication from customer applications. Basic local audit export stays OSS; a future paid boundary may cover storage, retention, search and organizational operation. Local semantic activation/validation stays OSS; managed multi-team governance is a possible paid capability, not a service-availability claim.

Aeliqo runtime should consume signed/versioned manifests through the same public interfaces regardless of whether they come from local files or a future hosted service. A hosted-service outage must not destroy already configured application UI. Graceful fallback and retention would require separate commercial contracts and verification; none is claimed for 0.1.0.

## No hidden incomplete component tier

Do not sell accessibility fixes, reliable tables, complete form states, SSR, production profiling hooks or standard charts as “enterprise-only.” A paid niche product could exist later, but it must not leave the announced v0.1.0 catalog incomplete. Custom enterprise services are not used to conceal generic framework defects.

## Licensing hygiene

The public repository is Apache-2.0. CONTRIBUTING.md documents the DCO sign-off and same-license inbound policy, and TRADEMARKS.md documents descriptive project-name and logo use. Any future commercial service code must live separately with a reviewed proprietary license; no such service implementation is claimed by 0.1.0. Do not copy private implementation into the public repository. Maintain third-party notices/SBOM and package-level license declarations. Any later licensing change needs an explicit decision and cannot erase existing grants.

This is product/license structure, not legal advice on a specific distribution transaction; obtain legal review before final commercial contracts.

## Initial buyer and evidence

Start with teams building data-heavy application experiences across several products: internal software teams, SaaS platform teams and agent-assisted application developers. Validate whether adoption survives beyond the demo: repeated integration, less glue code, fewer semantic/visual regressions, shorter meaningful onboarding, and willingness to pay for organization features.

Avoid asserting “no competitors.” Tambo focuses on agents using registered React components; declarative UI and visualization ecosystems already exist. The differentiator to test is governed meaning/query/task-preserving adaptation with Aeliqo-owned production components and one shared web implementation. [S18, S07]

## Pricing and unit economics

Do not fix a price before measuring willingness to pay and service cost. Candidate pricing dimensions: editor/organization seats for collaboration, service usage for managed operations, and annual enterprise support. Avoid per-render runtime fees that make embedding unpredictable. Track inference, storage, egress, support and enterprise onboarding costs separately; BYOK users should not pay twice for model usage.

Run a small paid pilot with an explicit success definition and exit path. Simulate cost at low, expected and high usage. Do not publish revenue forecasts as facts or use GitHub stars as retention evidence.

## Delivery scope

v0.1.0 completes the OSS product and a credible business boundary, not a full billing/SSO/SCIM enterprise SaaS platform. Build a simple pricing/contact/waitlist explanation only with truthful status. Commercial control-plane implementation is a separate roadmap after the OSS release and pilot validation; it is not allowed to delay essential library quality indefinitely.
