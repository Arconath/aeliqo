# Release-ready deterministic scenario suite

Run after building the public packages:

```sh
pnpm --filter @aeliqo/sdk-core build
pnpm --filter @aeliqo/sdk-runtime build
pnpm exec vitest run --config tests/scenarios/vitest.config.mjs
pnpm exec tsc -p tests/scenarios/tsconfig.json --noEmit
```

| Scenario IDs | Executable test | Scope |
| --- | --- | --- |
| S05, S06, S60, S65, S66 | `public-api-scenarios.test.ts` — code-defined meaning | Typed manual definition, immutable registration, activation grant, evaluation, and conflict rejection through `@aeliqo/sdk-core` and `@aeliqo/sdk-runtime/meaning`. No model is called. |
| S11, S19, S32 | `public-api-scenarios.test.ts` — data boundary | Principal-scoped rows and typed unsupported projection through `@aeliqo/sdk-runtime/data`; no hidden full-data fetch occurs. |
| S41, S44 | `public-api-scenarios.test.ts` — queryless/unknown contracts | A queryless presentation task and explicit unknown result metadata parse through `@aeliqo/sdk-core`; the test does not convert unknown into zero. |

The remaining ready-stage scenarios are intentionally not represented as a pass by
this suite: S01–S04, S07–S10, S12–S18, S20–S31, S33–S40, S42–S43, S45–S59,
S61, S63–S64, and S67. They need another production surface or non-local
evidence: browser/AT and visual matrix, actual provider/native-host evaluation,
action/composition integration, external tarball consumers, or registry/deployment
verification. Release-only S52 and S62 remain outside this ready-stage suite.
