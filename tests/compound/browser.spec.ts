import {expect, test} from "@playwright/test";
import {AxeBuilder} from "@axe-core/playwright";

type FixtureWindow = Window & {compoundFixture: {events: {type: string; detail: any}[]}};

test.beforeEach(async ({page}) => {
  await page.goto("/tests/compound/index.html");
  await expect(page.locator("#explorer").getByRole("heading", {name: "Explore", exact: true})).toHaveText("Explore");
});

test("explorer forwards filter and stable identity selection to the host", async ({page}) => {
  const explorer = page.locator("#explorer");
  const filter = explorer.locator("aeliqo-filter-builder");
  await filter.locator("input[part=value]").fill("Ada");
  await filter.locator("button[part=apply]").click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-explorer-filter")?.detail.predicate)).toEqual({op: "compare", entity: "person", field: "name", value: "Ada", comparison: "eq"});

  const record = explorer.locator("aeliqo-record-list").locator("button[part=record-button]").first();
  await record.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-explorer-selection")?.detail.keys)).toEqual(["string:1:a"]);
  await expect(explorer.locator("aeliqo-detail").locator("[part=identity]")).toContainText("string:1:a");
});

test("comparison and breakdown use shared bounded tables and host evaluated values", async ({page}) => {
  const comparison = page.locator("#comparison");
  await expect(comparison.locator("aeliqo-table")).toHaveCount(1);
  await expect(comparison.locator("aeliqo-table").getByRole("columnheader")).toHaveCount(3);
  await comparison.getByRole("button", {name: "Alpha", exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-comparison-set")?.detail)).toMatchObject({keys: ["b"], scope: {label: "Authorized people"}});

  const breakdown = page.locator("#breakdown");
  await expect(breakdown.locator("aeliqo-table")).toHaveCount(1);
  await expect(breakdown.locator("aeliqo-table")).toContainText("25%");
  await expect(breakdown.locator("aeliqo-table")).toContainText("Not available");
  await breakdown.locator("aeliqo-table input[type=radio]").first().check();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-breakdown-group")?.detail)).toMatchObject({key: "north", scope: {label: "Authorized people"}});
});

test("search results hide stale materialization and restore the matching revision", async ({page}) => {
  const search = page.locator("#search");
  await expect(search).toContainText("out of date");
  await expect(search.locator("aeliqo-card-collection")).toHaveCount(0);
  await page.evaluate(async () => {
    const element = document.querySelector("#search") as any;
    element.resultRevision = element.queryRevision;
    await element.updateComplete;
  });
  await expect(search.locator("aeliqo-card-collection")).toHaveCount(1);
  await expect(search.locator("[part=scope]").first()).toContainText("2 matching results");
});

test("record editor validates slotted fields and includes the explicit draft receipt", async ({page}) => {
  const editor = page.locator("#editor");
  await page.evaluate(async () => {
    const element = document.querySelector("#editor") as any;
    const field = element.querySelector("aeliqo-text-field") as any;
    field.value = "";
    await field.updateComplete;
    await element.updateComplete;
  });
  await editor.getByRole("button", {name: "Save", exact: true}).click();
  expect(await page.evaluate(() => (window as FixtureWindow).compoundFixture.events.filter(event => event.type === "aeliqo-record-editor-save").length)).toBe(0);
  await editor.locator("aeliqo-text-field").locator("input").fill("Ada Lovelace");
  await editor.getByRole("button", {name: "Save", exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-record-editor-save")?.detail)).toMatchObject({key: "a", entityRevision: "rev-1", values: {name: "Ada Lovelace"}});
  await editor.getByRole("button", {name: "Cancel", exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-record-editor-cancel")?.detail)).toMatchObject({key: "a", entityRevision: "rev-1", values: {name: "Ada Lovelace"}});
});

test("form flow keeps step scoped controls mounted, blocks invalid progression, and commits all steps", async ({page}) => {
  const flow = page.locator("#flow");
  await flow.getByRole("button", {name: "Next", exact: true}).click();
  expect(await page.evaluate(() => (window as FixtureWindow).compoundFixture.events.filter(event => event.type === "aeliqo-form-flow-step").length)).toBe(0);
  await expect(flow.locator("[part=step-panel]")).toHaveAttribute("data-step", "one");
  await flow.locator("aeliqo-text-field").locator("input").fill("Ada Lovelace");
  await flow.getByRole("button", {name: "Next", exact: true}).click();
  await expect(flow.locator("[part=step-panel]")).toHaveAttribute("data-step", "two");
  await flow.getByRole("button", {name: "Commit", exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window as FixtureWindow).compoundFixture.events.findLast(event => event.type === "aeliqo-form-flow-commit")?.detail.draft)).toMatchObject({displayName: "Ada Lovelace"});
});

test("compound states keep caution copy and remain accessible under RTL, zoom and forced colors", async ({page}) => {
  await page.evaluate(() => { document.documentElement.dir = "rtl"; document.documentElement.style.fontSize = "200%"; });
  await page.emulateMedia({forcedColors: "active"});
  await expect(page.locator("#investigation")).toContainText("do not establish causal claims");
  await expect(page.locator("#investigation aeliqo-trend [part=data] table")).toHaveCount(1);
  await expect(page.locator("#quality")).toContainText("Unsupported claims are shown explicitly");
  const results = await new AxeBuilder({page}).include("#fixture").analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({path: "artifacts/compound-browser/rtl-forced-colors.png", fullPage: true});
});
