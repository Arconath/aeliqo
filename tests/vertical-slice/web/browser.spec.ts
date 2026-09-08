import {expect, test} from "@playwright/test";

test("keyed region children retain focus and controlled draft state across reorder", async ({page}) => {
  await page.goto("/tests/vertical-slice/web/browser.html");
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoReady?: boolean}).aeliqoReady)).toBe(true);
  const filter = page.locator('aeliqo-input[data-aeliqo-node-id="filter-a"]');
  await filter.evaluate(async (element) => {
    const input = element as HTMLElement & {value: string; updateComplete: Promise<unknown>};
    input.value = "draft";
    await input.updateComplete;
    input.focus();
  });
  await page.evaluate(async () => {
    const app = window as typeof window & {reorderFilters: () => void};
    app.reorderFilters();
    await (document.querySelector("aeliqo-region") as HTMLElement & {updateComplete: Promise<unknown>}).updateComplete;
  });
  await expect(filter.locator("input")).toHaveValue("draft");
  const focus = await page.evaluate(() => {
    const region = document.querySelector("aeliqo-region") as HTMLElement;
    const child = region.shadowRoot?.querySelector('aeliqo-input[data-aeliqo-node-id="filter-a"]') as HTMLElement | null;
    return document.activeElement === region && region.shadowRoot?.activeElement === child && child?.shadowRoot?.activeElement?.tagName === "INPUT";
  });
  expect(focus).toBe(true);
});

test("region emits trusted table selection, clears explicitly, and keeps long form series separate", async ({page}) => {
  await page.goto("/tests/vertical-slice/web/browser.html");
  await page.evaluate(async () => {
    const app = window as typeof window & {mountSelection: () => void};
    app.mountSelection();
    await (document.querySelector("aeliqo-region") as HTMLElement & {updateComplete: Promise<unknown>}).updateComplete;
  });
  const checkbox = page.locator('aeliqo-table[data-aeliqo-node-id="table"] input[type="checkbox"]').first();
  await checkbox.check();
  const selected = await page.evaluate(() => (window as typeof window & {aeliqoEvents: any[]}).aeliqoEvents.at(-1));
  expect(selected.payload.selection).toMatchObject({mode: "ids", entity: "employees", keys: ["e1"], result: {outputId: "rows"}});
  const eventCount = await page.evaluate(() => (window as typeof window & {aeliqoEvents: any[]}).aeliqoEvents.length);
  await page.locator('aeliqo-table[data-aeliqo-node-id="table"]').evaluate((element) => {
    element.dispatchEvent(new CustomEvent("aeliqo-table-selection", {bubbles: true, composed: true, detail: {
      mode: "ids", entity: "other", keys: ["e1"], result: {id: "forged", revision: "1", outputId: "rows", queryDigest: "query", scopeDigest: "scope"},
    }}));
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoEvents: any[]}).aeliqoEvents.length)).toBe(eventCount);
  await checkbox.uncheck();
  const cleared = await page.evaluate(() => (window as typeof window & {aeliqoEvents: any[]}).aeliqoEvents.at(-1));
  expect(cleared.payload.selection).toEqual({mode: "clear"});

  await page.evaluate(async () => {
    const app = window as typeof window & {mountTrend: () => void};
    app.mountTrend();
    await (document.querySelector("aeliqo-region") as HTMLElement & {updateComplete: Promise<unknown>}).updateComplete;
  });
  const chart = page.locator('aeliqo-chart[data-aeliqo-node-id="trend"]');
  await expect(chart.locator('svg [part="line"]')).toHaveCount(8);
  const svgGeometry = await chart.evaluate((element) => [...(element.shadowRoot?.querySelectorAll("polyline") ?? [])].map((line) => {
    const svgLine = line as SVGPolylineElement;
    const box = svgLine.getBBox();
    return {namespace: line.namespaceURI, width: box.width, height: box.height, points: line.getAttribute("points")};
  }));
  expect(svgGeometry).toHaveLength(8);
  expect(svgGeometry.every((line) => line.namespace === "http://www.w3.org/2000/svg" && line.points !== null)).toBe(true);
  expect(svgGeometry.some((line) => line.width > 0 && line.height > 0)).toBe(true);
  await expect(chart.locator('[part="legend"] li')).toHaveCount(5);
  await expect(chart.locator('[part="legend"] [part="legend-marker"].style-1')).toHaveCount(1);
  await chart.locator("details summary").click();
  await expect(chart.locator("thead th")).toHaveCount(6);
  await expect(chart.locator("tbody tr")).toHaveCount(4);
  await expect(chart.locator("tbody td").filter({hasText: "—"})).toHaveCount(7);
  await expect(chart.locator("tbody tr").nth(3).locator("td").nth(4)).toHaveText("6");
});
