import {describe, expect, it} from "vitest";
import {html} from "lit";
import {validatePresentationPlan} from "../../packages/core/src/index.js";
import {renderAeliqo} from "../../packages/web/src/server.js";
import {createAeliqoPresentationRegistry} from "../../packages/web/src/region/registry.js";
import {binding, dataPresentationContext, dataPresentationPlan, registryOptions} from "./fixture.js";

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
});
