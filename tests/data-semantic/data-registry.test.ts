import { describe, expect, it } from "vitest";
import type { Result } from "@aeliqo/core";
import {
  createAeliqoDataRegistry,
  validateAeliqoDataBinding,
} from "../../packages/web/src/region/data-registry.js";

const ref = {
  id: "result",
  revision: "1",
  outputId: "people",
  queryDigest: "query",
  scopeDigest: "scope",
} as const;
const fields = [
  {
    id: "id",
    label: "ID",
    type: { value: "text" as const, nullable: false },
    role: "identity" as const,
  },
  {
    id: "name",
    label: "Name",
    type: { value: "text" as const, nullable: true },
    role: "attribute" as const,
  },
  {
    id: "amount",
    label: "Amount",
    type: {
      value: "decimal" as const,
      nullable: false,
      unit: { dimension: "currency", symbol: "USD" },
    },
    role: "measure" as const,
  },
  {
    id: "baseline",
    label: "Baseline",
    type: {
      value: "decimal" as const,
      nullable: false,
      unit: { dimension: "currency", symbol: "USD" },
    },
    role: "measure" as const,
  },
  {
    id: "department",
    label: "Department",
    type: { value: "text" as const, nullable: false },
    role: "dimension" as const,
  },
];
function result(overrides: Partial<Result> = {}): Result {
  return {
    version: "1",
    ref,
    taskId: "task",
    fields,
    identity: ["id"],
    rowGrain: ["id"],
    counts: {
      loaded: 2,
      population: { kind: "exact", value: 2, populationDigest: "population" },
    },
    precision: { kind: "exact" },
    coverage: { kind: "complete", populationDigest: "population" },
    consistency: {
      kind: "snapshot",
      snapshotId: "snapshot",
      sourceRevisions: { source: "1" },
    },
    evidence: { kind: "observed", source: { id: "source", revision: "1" } },
    filters: [],
    warnings: [],
    lineage: [],
    ...overrides,
  };
}
const rows = [
  {
    id: "a",
    name: "Ada",
    amount: { decimal: "12.50" },
    baseline: { decimal: "10.00" },
    department: "Sales",
  },
  {
    id: "b",
    name: "Bea",
    amount: { decimal: "7.00" },
    baseline: { decimal: "7.00" },
    department: "Design",
  },
] as const;
const binding = (
  override: Partial<{ result: Result; rows: typeof rows }> = {},
) => ({ result: override.result ?? result(), rows: override.rows ?? rows });

const registry = createAeliqoDataRegistry({ resolveEntity: () => "person" });
const resolve = (
  component: Parameters<typeof registry.resolve>[0]["component"],
  config: Record<string, unknown> = {},
  value = binding(),
) =>
  registry.resolve(
    {
      id: `node-${String(typeof component === "string" ? component : component.id)}`,
      component,
      config,
    },
    value,
  );

describe("authorized data binding", () => {
  it("requires the exact Result loaded count and validates declared scalar types", () => {
    expect(validateAeliqoDataBinding(binding({ rows: [rows[0]] })).ok).toBe(
      false,
    );
    expect(
      validateAeliqoDataBinding(
        binding({ rows: [{ ...rows[0], amount: 12.5 } as never] }),
      ).ok,
    ).toBe(false);
    expect(
      validateAeliqoDataBinding(
        binding({ rows: [{ ...rows[0], extra: "nope" }, rows[1]] as never }),
      ).ok,
    ).toBe(false);
  });

  it("rejects duplicate identities and preserves the descriptor scope", () => {
    expect(
      validateAeliqoDataBinding(
        binding({ rows: [rows[0], { ...rows[1], id: "a" }] }),
      ).ok,
    ).toBe(false);
    const checked = validateAeliqoDataBinding(binding());
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.value.result.ref).toEqual(ref);
      expect(checked.value.scope).toMatchObject({
        loaded: 2,
        populationTotal: 2,
        populationDigest: "population",
        kind: "population",
      });
    }
  });

  it("requires registered labels and types for supplied columns", () => {
    expect(
      validateAeliqoDataBinding({
        ...binding(),
        columns: [{ key: "name", label: "Wrong" }],
      }).ok,
    ).toBe(false);
    expect(
      validateAeliqoDataBinding({
        ...binding(),
        columns: [{ key: "name", label: "Name", type: "integer" }],
      }).ok,
    ).toBe(false);
    expect(
      validateAeliqoDataBinding({
        ...binding(),
        columns: [{ key: "name", label: "Name", type: "text" }],
      }).ok,
    ).toBe(true);
  });

  it("rejects non-record rows and accessors at the authorization boundary", () => {
    expect(
      validateAeliqoDataBinding(
        binding({ rows: [new Map() as never, rows[1]] }),
      ).ok,
    ).toBe(false);
    const getterRow = { ...rows[0] };
    Object.defineProperty(getterRow, "amount", {
      get: () => {
        throw new Error("untrusted getter");
      },
    });
    expect(
      validateAeliqoDataBinding(
        binding({ rows: [getterRow as never, rows[1]] }),
      ).ok,
    ).toBe(false);
  });
});

describe("data registry semantics", () => {
  it("registers all nine data views and only derives fields from the authorized Result", () => {
    expect(registry.manifests).toHaveLength(9);
    for (const component of [
      "metric",
      "delta",
      "keyValue",
      "detail",
      "recordList",
      "cardCollection",
      "table",
      "filterBuilder",
      "selectionSummary",
    ] as const) {
      const config =
        component === "metric"
          ? { field: "amount", identityValues: { id: "a" } }
          : component === "delta"
            ? {
                currentField: "amount",
                baselineField: "baseline",
                identityValues: { id: "a" },
              }
            : component === "keyValue"
              ? { items: [{ field: "name" }], identityValues: { id: "a" } }
              : component === "detail"
                ? {
                    fields: ["id", "name", "amount"],
                    identityValues: { id: "a" },
                  }
                : component === "filterBuilder"
                  ? { field: "department", outputId: "people" }
                  : component === "selectionSummary"
                    ? { selection: "multiple" }
                    : {
                        columns: [
                          { key: "id", label: "ID" },
                          { key: "name", label: "Name" },
                        ],
                        selection: "single",
                      };
      const outcome = resolve(component, config);
      expect(outcome.ok, component).toBe(true);
    }
  });

  it("does not aggregate a metric: multiple rows require explicit stable identity selection", () => {
    expect(resolve("metric", { field: "amount" }).ok).toBe(false);
    const selected = resolve("metric", {
      field: "amount",
      identityValues: { id: "b" },
    });
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.value.config.selectedRow?.id).toBe("b");
  });

  it("requires explicit compatible observations for delta and uses the result units", () => {
    expect(
      resolve("delta", {
        currentField: "amount",
        baselineField: "name",
        identityValues: { id: "a" },
      }).ok,
    ).toBe(false);
    const valid = resolve("delta", {
      currentField: "amount",
      baselineField: "baseline",
      mode: "percentage-point",
      identityValues: { id: "a" },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.value.config.delta?.currentRow.id).toBe("a");
  });

  it("does not allow presentation config to redefine identity or field labels", () => {
    expect(
      resolve("table", {
        identity: ["name"],
        columns: [{ key: "id", label: "ID" }],
      }).ok,
    ).toBe(false);
    expect(
      resolve("recordList", {
        columns: [{ key: "name", label: "Display name" }],
      }).ok,
    ).toBe(false);
  });

  it("requires a trusted entity before selection can create a selection port", () => {
    const noEntity = createAeliqoDataRegistry();
    expect(
      noEntity.resolve(
        { id: "table", component: "table", config: { selection: "single" } },
        binding(),
      ).ok,
    ).toBe(false);
    const selected = resolve("table", { selection: "single" });
    expect(selected.ok).toBe(true);
    if (selected.ok)
      expect(selected.value.config.ports[0]).toMatchObject({
        payload: "selection",
        entity: "person",
        identity: ["id"],
      });
  });

  it("accepts typed filter fields and requires exact output identity", () => {
    expect(
      resolve("filterBuilder", { field: "amount", outputId: "people" }).ok,
    ).toBe(true);
    expect(
      resolve("filterBuilder", { field: "department", outputId: "other" }).ok,
    ).toBe(false);
    const valid = resolve("filterBuilder", {
      field: "department",
      outputId: "people",
    });
    expect(valid.ok).toBe(true);
    if (valid.ok)
      expect(valid.value.config.ports).toEqual([
        { id: "filter", direction: "output", payload: "filter" },
      ]);
  });
});
