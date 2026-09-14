# Contract fixtures

This directory contains strict TypeScript examples and compile-time counterexamples for the four public Aeliqo document families.

- `reference.ts` models Catalog, Task, Result, and Experience documents.
- `examples.ts` covers multi-grain outputs, fixed cohorts, queryless presentations, forms, and unknown server-rendered state.
- `negative-tests.ts` contains assignments that the TypeScript compiler must reject.
- `reference-guards.ts` exercises bounded measurement, precision, versioned expressions, selected-ID events, graph structure, read sets, and operation coverage.

These fixtures supplement the runtime parsers and package tests. They are not a second implementation of the public API.
