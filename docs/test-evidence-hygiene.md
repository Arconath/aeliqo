# Test evidence recording

Run checks from the repository root. Normal validation keeps the retained files
in `docs/evidence/` unchanged:

```sh
env -u AELIQO_RECORD_EVIDENCE pnpm check
env -u AELIQO_RECORD_EVIDENCE pnpm proof:stress
```

Only the exact value `AELIQO_RECORD_EVIDENCE=1` enables recording. Use it on
individual commands when intentionally replacing local evidence, then inspect
the resulting diff before accepting it:

```sh
AELIQO_RECORD_EVIDENCE=1 pnpm test:parity
pnpm build
AELIQO_RECORD_EVIDENCE=1 pnpm test:browser tests/workspace.spec.ts tests/workspace-quality.spec.ts --project=chromium --workers=1
AELIQO_RECORD_EVIDENCE=1 pnpm proof:stress
git diff -- docs/evidence/
```

These commands update `protocol-parity.json`, `showcase-performance.json`,
`browser-workspace-quality.json`, and `unseen-intents-v2.json`, respectively.
The two browser artifacts are Chromium-only; other browsers still execute the
behavior assertions. Showcase recording follows all scenario assertions.
Recording is per test, not a transaction across the suite: a later test failure
does not undo an earlier artifact write. Do not run concurrent recording jobs.

The scale test already uses the same opt-in flag for `performance-scale.json`.
`pnpm perf` prints measurements without replacing `performance.json`.
Screenshots, traces, build output, and package reports in ignored output
directories remain normal disposable output. The separate manual
`freeze-catalog.ts`, `mcp-session.ts`, and `summarize-proof.ts` scripts write
historical evidence directly; they are not part of `pnpm check` and are not
covered by this opt-in policy.

Playwright-managed artifacts use `test-results/<run-id>/`. Each invocation
generates a UUID and passes it to workers through `AELIQO_TEST_RUN_ID`, preventing
one run's cleanup from deleting another run's artifacts. An explicit ID must be
1–64 ASCII letters, digits, underscores or hyphens and start with a letter or
digit. Give concurrent invocations distinct IDs; avoid a shared `--output`
override. Existing tests with explicit screenshot paths still use those paths.
Runs already started with the old configuration keep their old output directory.

The stress check compares the original eleven catalog entries and frozen data,
excluding only the known post-freeze Trend range ports and Table range/group
inputs. It executes current code against that historical projection; it does
not prove the entire current catalog is unchanged or repeat live agent proof.
Never regenerate the freeze merely to make the hash check pass.

To verify retained evidence without relying on an already-dirty Git diff:

```sh
evidence_manifest=$(mktemp -t aeliqo-evidence)
find docs/evidence -type f -exec shasum -a 256 {} + | LC_ALL=C sort > "$evidence_manifest"
env -u AELIQO_RECORD_EVIDENCE pnpm check
diff -u "$evidence_manifest" <(find docs/evidence -type f -exec shasum -a 256 {} + | LC_ALL=C sort)
```

The manifest comparison detects changed, added, and removed files even when
validation fails. Recording deterministic parity/stress or local browser
timings does not establish live-provider, native WebMCP, or release readiness.
