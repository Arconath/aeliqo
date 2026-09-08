import {describe, expect, it} from "vitest";
import {html} from "lit";
import {validatePresentationPlan} from "../../packages/core/src/index.js";
import {renderAeliqo} from "../../packages/web/src/server.js";
import {createAeliqoPresentationRegistry} from "../../packages/web/src/region/registry.js";
import {binding, result as fixtureResult, dataPresentationContext, dataPresentationPlan, registryOptions} from "./fixture.js";

describe("data semantic region SSR", () => {
  it("renders all eight canonical data views through the public registry", async () => {
    const registry = createAeliqoPresentationRegistry(registryOptions);
    if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
    const checked = validatePresentationPlan(dataPresentationPlan(), dataPresentationContext(), registry.value);
    if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
    const markup = await renderAeliqo(html`<aeliqo-region .presentation=${checked.value} .results=${[{ref: binding.result.ref, rows: binding.rows}]}></aeliqo-region>`);
    for (const tag of [
      "aeliqo-metric",
      "aeliqo-delta",
      "aeliqo-key-value",
      "aeliqo-detail",
      "aeliqo-record-list",
      "aeliqo-card-collection",
      "aeliqo-filter-builder",
      "aeliqo-selection-summary",
    ]) expect(markup).toContain(`<${tag}`);
    expect(markup).toContain("12.50");
    expect(markup).toContain("Ada");
    expect(markup).toContain("shadowrootmode=\"open\"");
  });

  it("retains exact observed deltas with partial or stale scope and keeps relative units dimensionless", async () => {
    for (const status of ["partial", "stale"]) {
      const markup = await renderAeliqo(html`<aeliqo-delta .current=${{decimal: "12.50"}} .baseline=${{decimal: "10.00"}} .status=${status} unit="USD"></aeliqo-delta>`);
      expect(markup).toContain("+2.5");
      expect(markup).toContain(status === "partial" ? "Showing a partial result." : "This result may be out of date.");
      expect(markup).toContain(`data-status="${status}"`);
      expect(markup).toMatch(/<span[^>]*part="unit"[^>]*>[\s\S]*?USD/);
    }
    const relative = await renderAeliqo(html`<aeliqo-delta .current=${{decimal: "12.50"}} .baseline=${{decimal: "10.00"}} mode="relative" unit="USD"></aeliqo-delta>`);
    expect(relative).toContain("+25%");
    expect(relative).not.toMatch(/<span[^>]*part="unit"/);
    const missing = await renderAeliqo(html`<aeliqo-delta .current=${{decimal: "12.50"}} status="partial"></aeliqo-delta>`);
    expect(missing).toContain("Value unavailable.");
  });

  it("preserves registered host scope annotations alongside the current materialization", async () => {
    const scope = {kind: "loaded" as const, loaded: 2, populationTotal: 3, populationDigest: "population-1", label: "Active people"};
    const registry = createAeliqoPresentationRegistry({...registryOptions, data: [{...binding, scope}]});
    if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
    const checked = validatePresentationPlan(dataPresentationPlan(), dataPresentationContext(), registry.value);
    if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
    const markup = await renderAeliqo(html`<aeliqo-region .presentation=${checked.value} .results=${[{ref: binding.result.ref, rows: binding.rows, scope}]}></aeliqo-region>`);
    expect(markup).toContain("<aeliqo-filter-builder");
    expect(markup).toContain("Active people; 2 of 3 population records loaded");
    expect(markup).not.toContain("Data unavailable.");
  });

  it("keeps observed values readable while population coverage is unknown", async () => {
    const unknownResult = {...fixtureResult, coverage: {kind: "unknown" as const, reason: "Population membership has not been established"}};
    const registry = createAeliqoPresentationRegistry({...registryOptions, data: [{...binding, result: unknownResult}]});
    if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
    const checked = validatePresentationPlan(dataPresentationPlan(), {...dataPresentationContext(), results: [unknownResult]}, registry.value);
    if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
    const markup = await renderAeliqo(html`<aeliqo-region .presentation=${checked.value} .results=${[{ref: unknownResult.ref, rows: binding.rows}]}></aeliqo-region>`);
    expect(markup).toContain("12.50");
    expect(markup).toContain("+2.5");
    expect(markup).toContain("Scope unknown; 2 of 3 population records loaded");
    expect(markup).not.toContain("Value unavailable.");
  });
});
