# Synthetic ADC reference host

This local example serves synthetic commerce or HR records through the same
`@aeliqo/sdk-runtime/data` service used in process. It binds only to `127.0.0.1` on an
available port and exposes the generic describe/plan/execute API. It performs no
database discovery, provider calls, or production data access.

From the repository, build with `pnpm build:runtime`, then run
`pnpm --filter @aeliqo/reference-host start` (commerce) or
`pnpm --filter @aeliqo/reference-host start --hr` (HR).
Stop with Ctrl-C. `pnpm --filter @aeliqo/reference-host test` verifies local/HTTP
parity against independent expected values and shuts its own server down.

`fixtures.mjs` declares reviewed synthetic meanings as typed expression data.
Raw HR records come from the canonical fixture. Missing observations stay unknown;
approved leave is excluded through an explicit joined-field filter. All policy
arithmetic runs in the production query engine. The test alone reads expected
results from the independent oracle.

The example uses a public synthetic principal. It is not an authentication
template: an application must supply its own authenticated principal and read
policy. The SDK authorizes required fields and all joined source rows before
evaluation. The registry must match the catalog; source/work limits and response
limits have separate roles. No route accepts new code, registry functions, or
meaning activation from a client.

This slice proves one query at a time. Named-output orchestration, authorized
result cohorts, UI rendering and the full reference-host acceptance remain later
integration work.
