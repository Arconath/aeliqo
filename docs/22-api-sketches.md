# 22 — Public API contract direction

These are **design sketches**, not currently published v0.1.0 APIs. `contracts/reference.ts` is a typed reference model whose compilation can be checked; it is not the finished runtime implementation. M1 must generate and test final public declarations/schemas; all user-facing quickstarts must then compile against built packages.

## Progressive adoption

```ts
// Target convenience API: no agent/region required for basic use.
const people = rowsSource({ id: 'people', records, identity: 'id' });
```

```tsx
// Target direct component binding; the implementation is shared with web elements.
<Table source={people} columns={['name', 'department']} />
```

```ts
// Target application-owned service integration; not generic arbitrary API inference.
const data = connectData({ endpoint: '/aeliqo/data', catalog: suppliedManifest });
const app = createAeliqo({ data, experience: recordInspectionProfile() });
```

```tsx
<Region runtime={app} id="people" initialTask={employeeInspection} />
```

The final direct API should support a plain-record shortcut with clear identity behavior. It must not require a DataService for a single known value. Semantic and region entry points add coordination rather than duplicate implementations.

## Derived meaning

The code editor and Studio serialize the same definition. An AI draft is not a function string. A reference definition contains expression, type/unit/grain, dependency versions, provenance, activation scope and null/zero policy. A domain-specific server metric may be registered as an opaque named capability with a verifiable output contract instead of exposing its private formula; Aeliqo must then treat its execution as host-owned and not emulate it locally.

## Data integration truth

A schema or sample provides shape; it does not implement API pagination/auth/joins. A source factory needs executable application capability through the data port or a bounded local implementation. `connectData('/openapi.json')` cannot be advertised as solving every query just because an OpenAPI document parsed.

## API ergonomics tests

Inference of row identity/field keys where safely possible; no redundant schema boilerplate; clear async/loading/error states; concise typed callbacks; stable imports; no accidental model instantiation; no global singleton; explicit disposal in non-framework use; helpful type errors for invalid metrics/fields; and runtime errors for untrusted wire input.

## Support boundaries

Publish the exact tested Node/browser/framework matrix. A pure core works without React. The shipped ready-made browser components use one web implementation. Thin React bindings are first-class; other frontend frameworks can consume the web elements where the actual interoperability tests pass. Do not claim native-platform or universal SSR support from a framework-agnostic type definition.

## Master consolidation multioutput and effect boundaries

The revised reference model supports a data Task with named query/reuse outputs and typed dependencies; a presentation Task reuses ResultRefs; a form Task uses an approved schema/action descriptor with no dummy query. `contracts/examples.ts` compiles examples of these shapes. A runtime API may offer concise builders, but those are implementation ergonomics over the same values, not an alternate semantic system.

The agent-facing phases are propose/bind/evaluate/inspect/present. A proposed expression or composition is never immediately trusted. Concrete built-in interaction payloads are typed. Version-bound references and commit preconditions make state transfer explicit. Measurement unknown, count unknown, approximate output and mixed consistency are representable states—not omitted metadata that silently defaults to trustworthy values.

## Developer-first meaning registration (edition 1.1)

This is an **API design target, not an available npm API or a compiled example in this kit**. T04/T06/T25 must finalize these helpers against canonical schemas and compile the published documentation against built packages.

```ts
// meanings.ts — hr references existing, approved catalog metrics.
// The domain already defines eligible workdays and unexcused absence.
export const absenceRate = defineMetric({
  id: "hr.absenceRate",
  label: "Ketidakhadiran tanpa izin",
  description: "Hari absen tanpa izin / hari kerja yang wajib dijalani",
  expression: ratioOfSums({
    numerator: hr.metrics.unexcusedAbsentDays,
    denominator: hr.metrics.eligibleWorkdays,
    zeroDenominator: "null",
  }),
  format: "percent",
});

// app.ts — registration uses the application's reviewed bundle/policy.
const app = createAeliqo({
  data: hrData,
  meanings: [absenceRate],
});
```

The `hr` descriptors, data service and authorized deployment context already exist; the example is not a claim that two factory calls define all raw attendance policies. Infer compatible output type/unit/grain and dependencies only from confirmed metadata, not property names. Supply unresolved facts explicitly. Version/digest may be managed by the reviewed bundle instead of repeated by hand on every field. Do not put authority-granting flags in the metric object.

`ratioOfSums` recomputes the pooled rate from compatible numerator/denominator totals, with missing-pair behavior declared by the canonical contract; it does not average row percentages. This meaning can serve table, trend, ranking and comparison requests without UI code inside the definition. A helper's formatter selects display format, not missing currency, scale or business policy.

If the host already computes a private metric, register its existing capability and result contract instead; do not force the developer to rewrite its calculation in the DSL. Both expression-backed and host-backed paths retain semantic version/scope checks.

Product DX acceptance: zero model calls for code-only registration, no duplicate schema, typed valid/invalid examples, standalone imports without Studio/agent dependency, local preview/tests, equivalent definitions across authoring surfaces, and explicit read-only/diff behavior for repo-owned meaning. T25 compiles these docs from tarballs. Reference/harness success is not proof those future APIs work.
