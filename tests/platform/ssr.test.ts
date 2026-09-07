import {describe, expect, it} from "vitest";
import {html} from "lit";
import {renderAeliqo} from "../../packages/web/src/server.js";

describe("T02 SSR boundary", () => {
  it("keeps browser-free imports and renders declarative shadow roots", async () => {
    expect(globalThis.window).toBeUndefined();
    const escapedValue = "<script>window.serverSecret = true</script>";

    const output = await renderAeliqo(html`
      <main>
        <aeliqo-input label="Name" value=${escapedValue} name="person"></aeliqo-input>
        <aeliqo-table
          caption="People"
          .columns=${[
            {key: "name", label: "Name"},
            {key: "role", label: "Role"},
          ]}
          .rows=${[{name: "Ada", role: "Engineer"}]}
        ></aeliqo-table>
        <aeliqo-chart
          title="Activity"
          summary="A trend with an accessible data table."
          unit="events"
          .points=${[
            {label: "Mon", value: 3},
            {label: "Tue", value: 5},
          ]}
        ></aeliqo-chart>
      </main>
    `);

    expect(output).toContain("<aeliqo-input");
    expect(output).toContain("shadowrootmode=\"open\"");
    expect(output).toContain("<table");
    expect(output).toContain("<svg");
    expect(output).toContain("View data table");
    expect(output).toContain("&lt;script&gt;window.serverSecret = true&lt;/script&gt;");
    expect(output).not.toContain("<script>window.serverSecret");
  });

  it("reports non-finite chart values without emitting invalid SVG geometry", async () => {
    const output = await renderAeliqo(html`
      <aeliqo-chart
        title="Invalid activity"
        .points=${[{label: "Bad", value: Number.NaN}]}
      ></aeliqo-chart>
    `);

    expect(output).toContain("Chart unavailable: values must be finite.");
    expect(output).not.toContain('points="NaN');
    expect(output).not.toContain('cx="NaN"');
  });

  it("keeps SVG geometry finite for finite extreme values", async () => {
    const output = await renderAeliqo(html`
      <aeliqo-chart
        title="Extreme activity"
        .points=${[
          {label: "Low", value: -Number.MAX_VALUE},
          {label: "High", value: Number.MAX_VALUE},
        ]}
      ></aeliqo-chart>
    `);

    expect(output).not.toContain("NaN");
    expect(output).not.toContain("Infinity");
    expect(output).toContain('points="24,146 304,14"');
  });
});
