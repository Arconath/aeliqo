# 20 — OSS to business: boundary and validation

## Decision: useful OSS first, additive commercial value

Core must be desirable without cloud or agent subscription. The owner selected Apache-2.0 for the repository and five public packages on 7 September 2026. Apache-2.0 permits broad reuse and includes copyright/patent terms and notice obligations; it is not an anti-fork license. Repository ownership and dependency evidence is recorded separately and remains an engineering inventory rather than legal advice. [R26]

## Public versus private

| Surface | OSS/public proposal | Commercial/private proposal |
|---|---|---|
| Core contracts/grammar/validators | Public, versioned and usable independently | No paid-only ability to interpret saved basic workspaces |
| L1/L2/L3 essentials | Core controls, table/charts, Explorer/Comparison, workspace/layout/pins/links/undo | Specialized advanced packages selected through demand |
| Quality | Basic accessibility, correctness, performance, virtualization, cancellation, isolation | Support/SLA/custom integration; not fixes withheld from OSS |
| Agent access | Local/self-host MCP bridge, BYOK integration, experimental WebMCP adapter | Managed operational convenience and enterprise deployment assistance |
| Extensibility | Public manifests, DataPort/RendererPort/ActionPort, custom component registration | Proprietary specialized implementations using those same contracts |
| Data/export | Authorized basic CSV/JSON/spec export and provenance | Advanced branded multi-page reporting/export workflows if buyers need them |
| Docs/tests | Core docs/examples/conformance tests; public Pro usage docs | Private customer data, keys, internal ops and commercial source as licensed |
| Hosted services | Self-host path remains | Managed tenancy, hosting/operations, team rollout, governance services |

Do not label commercially restricted source as open source. Browser-delivered code is observable; licensing/support/value, not obfuscation, is the commercial mechanism. Keep proprietary packages/services in explicitly private repositories or separately controlled source trees. A `.gitignore` or npm exclusion does not retract files already committed publicly. Review release artifacts and history before publication.

## First paid offer

Start with paid integration/engineering support or one advanced module requested by several design partners, such as a true pivot/OLAP workbench or specialized reporting. Do not build all hypothetical Pro components, a managed gateway and an enterprise control plane at once. Core cross-filtering/comparison must remain useful; don't paywall the product's defining basic capability.

MUI X and AG Grid show adjacent models combining free/community functionality with paid advanced features/support. They establish that such packaging exists, not that Aeliqo has demand or equivalent quality. [R27, R28]

## Buyer and willingness-to-pay test

Initial buyer: engineering lead/platform team building interactive data workflows in React. User: frontend engineer implementing them and analyst/operator using the app. Budget motivation: reduced integration work, fewer data mistakes, reliable polished UX, predictable support. A beautiful agent demo alone may not unlock a library purchase.

Internal research targets (hypotheses): 10–15 qualified interviews, five independent pilot integrations, at least three explicit paid-pilot commitments with a real budget owner before building an expensive premium product. Track unassisted activation, repeated use after two/four weeks, replacement cost and requested premium capability. “Looks cool” or GitHub stars is not paid demand.

## Pricing experiments, not published promises

Test developer/team licensing with clear rights, maintenance/update period, seats and evaluation terms. The earlier blueprint's USD 199–399 per developer/year is a hypothesis to interview, not validated pricing. Managed service price should follow real operational cost and value; do not announce an unlimited plan. BYOK model inference remains separately paid to the selected provider unless a future product explicitly includes it.

Simple unit-economics worksheet: revenue per customer minus attributable support hours × loaded support cost minus hosting/third-party cost minus acquisition/collection cost. Contribution must cover ongoing maintenance and incident risk. A license price below a customer's support burden is not sustainable merely because software copying is cheap.

## Distribution

Launch with one credible comparison/explorer workflow, a production-style revenue/incident recipe, copyable standalone components, migration examples from plain table/chart combinations, and published benchmark methodology. Provide learning articles about semantic correctness and interactive composition rather than generic “AI changes everything” claims. External examples and references to known limitations are more convincing than a long list of planned widgets.

Use OSS issues/discussions to distinguish bug, missing capability and paid integration need. Publish compatibility/version/deprecation policies. License/trademark/name availability review precedes public launch; kit does not claim Aeliqo name/package availability.

## Go / reshape criteria

Proceed when independent developers repeatedly use the core and buyers name a costly advanced need. Reshape positioning if users want only generated chat UI or only an ordinary chart library, because those may not justify our semantic overhead. Defer premium if pilots demand core correctness/usability fixes first. This is disciplined business validation, not a prediction of commercial success or competitor superiority.
