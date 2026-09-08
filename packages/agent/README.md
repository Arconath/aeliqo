# @aeliqo/agent

Optional agent boundaries for the Aeliqo 0.1.0 rewrite. The package depends on the
pure core and effect-owning runtime; direct components and normal interactions do
not import it. Provider/protocol adapters are a later implementation task.

## Structured narrative evidence

`createNarrativeVerifier({readContext, maxRows?}).verify(input)` parses a core
`NarrativeClaim` and resolves its cells from current, host-authorized
`ResultHandle` objects. `readContext` is application code; a wire proposal cannot
supply authority, grants, resolvers, records, or a verified receipt. The independent
`result.inspect` grant is required. The host exposes only the current authorized
handle for an exact result reference.

Value and comparison claims require ready, complete, exact, snapshot-consistent,
observed or computed evidence. Every cell specifies a result revision, output,
query/scope digest, stable row identity, field, semantic type, definition, population,
filters and optional period. The verifier resolves the actual value, uses core
exact scalar comparisons, and rechecks authority and handle state before returning
`verified`. Decimal values retain exact string representation. Null values can be
verified as null; comparisons involving null remain unknown.

The verifier conservatively rejects partial/sample/approximate/inferred evidence.
It does not certify business definitions, user intent, causal interpretation, or
natural-language entailment. `inference` and `hypothesis` always return
`unverified`, regardless of citation presence. A verified receipt is evidence at
verification time; hosts must reverify after authority/result changes before
presenting it and must not treat it as a permission token.

Verification scans at most 100,000 rows by default across both comparison cells;
`maxRows` may be configured from 1 through 1,000,000. It reads existing immutable
batches and performs no data query, action, presentation commit, network request,
or model call. Diagnostics contain no records or host exception text.
