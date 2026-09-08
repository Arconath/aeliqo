import {expect, test} from "@playwright/test";

test("native table preserves exact values, stable identity and scope", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const table = page.locator("#table");
  await expect(table.locator("table")).toHaveCount(1);
  await expect(table.locator("td").filter({hasText: "100000000000000000.01"})).toHaveCount(1);
  await expect(table.locator("[part=scope]")).toHaveText("Showing 2 of 100 rows.");
  await table.locator("input[type=checkbox]").first().check();
  await expect.poll(() => page.evaluate(() => (window as unknown as {dataFixture: {events: {type: string; detail: {keys?: string[]}}[]}}).dataFixture.events.findLast((event) => event.type === "aeliqo-table-selection")?.detail.keys)).toEqual(["string:1:a"]);
  const selection = await table.locator("input[type=checkbox]").first().evaluate((input) => (input as HTMLInputElement).getAttribute("aria-label"));
  expect(selection).toContain("string:1:a");
});

test("grid mode is explicit and virtualization remains bounded", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const grid = page.locator("#grid");
  await expect(grid.locator("[role=grid]")).toHaveCount(1);
  await expect(grid.locator("[role=row][data-row-index]")).toHaveCount(1);
  await expect(grid.locator("[part=scope]")).toHaveText("Showing 2 of 100 rows.");
  await grid.locator("[role=row][data-row-index]").focus();
  await page.keyboard.press("ArrowDown");
  await expect(grid.locator("[role=row][data-row-index]").first()).toBeFocused();
});

test("filter typing is draft-only and Apply emits the typed predicate", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const filter = page.locator("#filter");
  const input = filter.locator("input[part=value]");
  await input.fill("Ada");
  expect(await page.evaluate(() => (window as unknown as {dataFixture: {events: {type: string}[]}}).dataFixture.events.filter((event) => event.type === "aeliqo-filter-change").length)).toBe(0);
  await filter.locator("button[part=apply]").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {dataFixture: {events: {type: string; detail: {predicate?: {op: string; field: string; value: string}}}[]}}).dataFixture.events.findLast((event) => event.type === "aeliqo-filter-change")?.detail.predicate)).toEqual({op: "compare", field: "name", value: "Ada", comparison: "eq"});
});
