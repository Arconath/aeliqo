# Local preflight — 8 September 2026

Foundation source: c3171998b27bc56a45d1c8dede6fccc2b3c61db2, parent 75540de0de5f6dfc7fc383afdd3f8325e590cfd9 (fresh origin/main fetch). Local recovery tag: archive/pre-rewrite-0.1.0-75540de. Full remote history fetched; production unchanged. Initial kit archive saved outside repository at /tmp/aeliqo-preflight-20260908/foundation-before-edits.tar.gz. Git author is scoped to this repository using authenticated GitHub account Hermawan (hermawan22), public noreply address; global audit identity unchanged.

Before source edits, integrity differed only in seven mutable validation/current logs/summary, matching prior local validation. Original MANIFEST.json remains the distributed baseline, not a claim that an intentionally modified implementation tree is pristine.

Python 3.14.7 on macOS returned /var/folders temporary roots. Bootstrap intentionally rejects symlink ancestors; /var is an OS symlink. Expected-success fixtures now resolve the OS-provided root; explicit destination and ancestor symlink regressions remain enforced. Production bootstrap security policy is unchanged. TypeScript was missing from PATH; an exact local dependency now runs both guards and version reporting without global installation.

reference-validation/ preserves the actual successful run and source digest, including 161 Python harness tests and strict TypeScript/Node guards. This is reference/kit evidence only. Product-ready and release gates correctly return BLOCKED (exit 1); their expected-block tests are not product PASS. Runtime and model evaluation, manual AT, publication and live deployment remain unproven.

Independent reviewer: Luna Max preflight_diagnosis confirmed root cause and the 161-test run; focused code review recorded separately. No remote source, registry or production mutation yet.
