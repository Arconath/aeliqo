# Studio review packet

This is an independent regression packet for the local Studio boundary. It
checks the defects found during the T26 review without changing product test
commands or accepting reference-only evidence:

- catalog imports rebuild the meaning registry;
- accepted document revisions retain an immutable ID/revision ledger;
- meaning dependency validation is independent of draft array order;
- public runtime setters and malformed calls fail closed;
- callers cannot self-declare code provenance;
- malformed import feedback is visible to a browser user; and
- navigation preserves a partially authored meaning draft and focus.

Run the deterministic probes with:

```sh
pnpm build:runtime && pnpm --filter @aeliqo/devtools build
pnpm exec vitest run --config tests/studio-review/vitest.config.mjs
pnpm exec tsc -p tests/studio-review/tsconfig.json
```

Run the browser probes with:

```sh
pnpm exec playwright test --config tests/studio-review/playwright.config.mjs
```

The browser packet owns port `4177` and may run beside the product's existing
Studio browser suite. A failed assertion is recorded as a review finding; the
packet does not weaken the product gate or turn on an auto-accept path.
