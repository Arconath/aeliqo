# Reference contracts and executable counterexamples

These files are a **design reference**, not the public Aeliqo SDK or a complete schema validator. M1 must implement canonical generated runtime validation and port these vectors to actual packages. Do not adopt this directory as a shortcut production engine.

- reference.ts: four document families, internal graphs/ports, tagged state and policy/version references.
- examples.ts: type-checked multigrain output, fixed cohort, queryless presentation/form and unknown SSR examples.
- negative-tests.ts: 12 invalid assignments that the compiler must reject.
- reference-guards.ts: bounded guards for measurement/count/precision/versioned expression structure, selected-ID event, dependency/containment graph, read-set and operation coverage.

The guard layer intentionally omits full QuerySpec validation, all event kinds, predicate selection, dependency type/grain evaluation, complete date parsing, layout/a11y equivalence, executor authentication and actual rendering. It is not acceptable to claim those omitted behaviors pass because Node reference tests pass.

Run `python3 scripts/test_reference.py`. It requires available Node and tsc, uses strict options and ES2022 without DOM, and writes disposable build output under artifacts/reference-build. The test runner exits blocked when a prerequisite is missing; it does not install unknown dependencies.

The Python experiments in scripts/semantic_reference.py and presentation_reference.py are independent oracles/search experiments only. They do not constitute the TypeScript query or presentation compiler. Full log classification is in ../VALIDATION.md.
