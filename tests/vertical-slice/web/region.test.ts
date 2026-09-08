import {describe, expect, it} from "vitest";
import {
  AELIQO_PRESENTATION_REFS,
  AELIQO_OPERATION_REFS,
  createAeliqoPresentationRegistry,
  createSelectionIdentityMapping,
} from "../../../packages/web/src/region/index.js";
import {validatePresentationPlan, type PresentationContext, type PresentationPlan} from "../../../packages/core/src/index.js";
import {stableTableRowKey} from "../../../packages/web/src/elements/aeliqo-table.js";
import {buildAeliqoChartGeometry} from "../../../packages/web/src/elements/aeliqo-chart.js";
import {environment, experience, field, presentationPlan, presentationTask, ref, result as baseResult} from "../../contracts/fixtures.js";

const result = {
  ...baseResult,
  rowGrain: ["employee.id", "month"],
  fields: [
    field,
    {id: "month", label: "Month", type: {value: "date", nullable: false}, role: "time" as const},
    {id: "amount", label: "Amount", type: {value: "decimal", nullable: true}, role: "measure" as const},
  ],
} as const;

function registry() {
  const created = createAeliqoPresentationRegistry({resolveEntity: (authorizedResult) => authorizedResult.ref.outputId === "rows" ? "employees" : undefined});
  if (!created.ok) throw new Error(JSON.stringify(created.diagnostics));
  return created.value;
}

describe("T39 registered web region", () => {
  it("exposes bounded stack, table, trend and filter manifests", () => {
    const refs = registry().manifests.map((manifest) => manifest.ref);
    expect(refs).toEqual([
      AELIQO_PRESENTATION_REFS.stack,
      AELIQO_PRESENTATION_REFS.table,
      AELIQO_PRESENTATION_REFS.trend,
      AELIQO_PRESENTATION_REFS.filter,
    ]);
    expect(registry().manifests.find((manifest) => manifest.ref.id === AELIQO_PRESENTATION_REFS.table.id)?.operations).toContainEqual(AELIQO_OPERATION_REFS.selection);
  });

  it("derives table selection ports from the Result identity and rejects unknown config", () => {
    const manifest = registry().manifests.find((candidate) => candidate.ref.id === AELIQO_PRESENTATION_REFS.table.id)!;
    const configured = manifest.resolveConfig({selection: "multiple"}, result);
    expect(configured).toMatchObject({ok: true, value: {fields: ["employee.id", "month", "amount"], operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.selection], ports: [{id: "selection", payload: "selection", entity: "employees", identity: ["employee.id"]} ]}});
    expect(manifest.resolveConfig({html: "<script>bad</script>"}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.config"}]});
    expect(manifest.resolveConfig({columns: [{key: "amount", label: "Absence"}]}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.field"}]});
    expect(manifest.resolveConfig({selection: "multiple", identity: ["month"]}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.identity"}]});
    expect(manifest.resolveConfig({selection: "multiple"}, result)).toMatchObject({ok: true, value: {ports: [{entity: "employees"}]}});
    const defaultRegistry = createAeliqoPresentationRegistry();
    expect(defaultRegistry.ok && defaultRegistry.value.manifests.find((candidate) => candidate.ref.id === AELIQO_PRESENTATION_REFS.table.id)?.resolveConfig({selection: "multiple"}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.binding"}]});
    expect(manifest.suggestConfig?.([{id: "select", operation: AELIQO_OPERATION_REFS.selection, fields: ["employee.id"], required: true}], result)).toMatchObject({ok: true, value: {selection: "single"}});
  });

  it("passes a table plan through the core validator with resolved typed selection ports", () => {
    const tablePlan: PresentationPlan = {
      ...presentationPlan,
      rootId: "table",
      nodes: [{id: "table", role: "table", representation: AELIQO_PRESENTATION_REFS.table, result: ref,
        config: {schema: {id: "data.table.config", revision: "1"}, values: {selection: "multiple"}}, children: []}],
      coverage: [{needId: "browse", nodeIds: ["table"], operations: [AELIQO_OPERATION_REFS.read]}],
      links: [],
    };
    const context: PresentationContext = {
      task: {...presentationTask, needs: [{id: "browse", operation: AELIQO_OPERATION_REFS.read, fields: ["employee.id"], outputId: "rows", required: true}]},
      experience: {...experience, allowedRepresentations: [AELIQO_PRESENTATION_REFS.table.id]},
      results: [baseResult], current: presentationPlan.preconditions, environment,
      rendererCapabilities: [AELIQO_PRESENTATION_REFS.table],
    };
    const checked = validatePresentationPlan(tablePlan, context, registry());
    expect(checked).toMatchObject({ok: true, value: {nodes: [{config: {ports: [{id: "selection", payload: "selection"}]}}]}});
  });

  it("keeps trend series fields and filter semantics typed", () => {
    const manifests = registry().manifests;
    const trend = manifests.find((candidate) => candidate.ref.id === AELIQO_PRESENTATION_REFS.trend.id)!;
    expect(trend.resolveConfig({labelField: "month", series: [{field: "amount"}], seriesBy: ["employee.id"]}, result)).toMatchObject({ok: true, value: {fields: ["month", "employee.id", "amount"], operations: [AELIQO_OPERATION_REFS.read, AELIQO_OPERATION_REFS.compare]}});
    expect(trend.resolveConfig({labelField: "month", series: [{field: "amount", label: "Absence"}]}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.field"}]});
    expect(trend.resolveConfig({labelField: "employee.id", series: [{field: "amount"}]}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.field"}]});
    expect(trend.resolveConfig({labelField: "month", series: [{field: "month"}]}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.field"}]});
    expect(trend.suggestConfig?.([{id: "trend", operation: AELIQO_OPERATION_REFS.compare, fields: ["employee.id", "month", "amount"], outputId: "rows", required: true}], result)).toMatchObject({ok: true, value: {labelField: "month", series: [{field: "amount"}], seriesBy: ["employee.id"]}});
    const filter = manifests.find((candidate) => candidate.ref.id === AELIQO_PRESENTATION_REFS.filter.id)!;
    expect(filter.resolveConfig({field: "employee.id", outputId: "rows"}, result)).toMatchObject({ok: true, value: {fields: ["employee.id"], operations: [AELIQO_OPERATION_REFS.filter], ports: [{payload: "filter"}]}});
    expect(filter.resolveConfig({field: "employee.id", outputId: "rows", label: "Untrusted claim"}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.config"}]});
    expect(filter.resolveConfig({field: "month", outputId: "rows"}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.field"}]});
    expect(filter.resolveConfig({field: "employee.id", outputId: "other"}, result)).toMatchObject({ok: false, diagnostics: [{code: "web.presentation.binding"}]});
    expect(filter.suggestConfig?.([{id: "filter", operation: AELIQO_OPERATION_REFS.filter, fields: ["employee.id"], outputId: "rows", required: true}], result)).toMatchObject({ok: true, value: {field: "employee.id", outputId: "rows"}});
  });

  it("uses stable identity tuples and registered identity mappings", () => {
    expect(stableTableRowKey({"employee.id": "e1", month: "Jan"}, ["employee.id"])).toBe("e1");
    expect(stableTableRowKey({"employee.id": "e1", month: "Jan"}, ["employee.id", "month"])).toBe(JSON.stringify(["e1", "Jan"]));
    expect(stableTableRowKey({month: "Jan"}, ["employee.id"])).toBeUndefined();
    expect(createSelectionIdentityMapping("employees", ["employee.id"])).toEqual({
      ref: {id: "selection.identity", revision: "1"},
      source: {payload: "selection", entity: "employees", identity: ["employee.id"], grain: ["employee.id"]},
      target: {payload: "selection", entity: "employees", identity: ["employee.id"], grain: ["employee.id"]},
      kind: "identity",
    });
  });

  it("builds separate SVG segments for null gaps and keeps multiple series distinct", () => {
    const geometry = buildAeliqoChartGeometry([
      {id: "actual", label: "Actual", points: [{label: "Jan", value: 1}, {label: "Feb", value: null}, {label: "Mar", value: 3}]},
      {id: "target", label: "Target", points: [{label: "Jan", value: 2}, {label: "Feb", value: 2}, {label: "Mar", value: 4}]},
    ]);
    expect(geometry.segments).toHaveLength(3);
    expect(geometry.segments.filter((segment) => segment.seriesIndex === 0)).toHaveLength(2);
    expect(geometry.segments.filter((segment) => segment.seriesIndex === 1)).toHaveLength(1);
    expect(geometry.circles).toHaveLength(5);
    expect(geometry.segments.every((segment) => segment.points.length > 0)).toBe(true);
  });
});
