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
  expect(selection).toBe("Select row a");
});

test("grid mode is explicit and virtualization remains bounded", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const grid = page.locator("#grid");
  await expect(grid.locator("[role=grid]")).toHaveCount(1);
  await expect(grid.locator("[role=grid]")).toHaveAttribute("aria-rowcount", "101");
  await expect(grid.locator("[role=row][aria-rowindex='1']")).toHaveCount(1);
  await expect(grid.locator("[role=gridcell][data-col-index='0']").first()).toHaveAttribute("aria-colindex", "1");
  await expect(grid.locator("[role=row][data-row-index]")).toHaveCount(1);
  await expect(grid.locator("[part=scope]")).toHaveText("Showing 1 rendered of 2 loaded rows; 100 matching rows.");
  const firstCell = grid.locator("[role=gridcell][data-row-index='0'][data-col-index='0']");
  await firstCell.focus();
  await page.keyboard.press("ArrowRight");
  await expect(grid.locator("[role=gridcell][data-row-index='0'][data-col-index='1']")).toBeFocused();
  await page.evaluate(async () => { const table = (document.querySelector("#grid") as any); table.virtualized = false; await table.updateComplete; });
  await grid.locator("[role=gridcell][data-row-index='0'][data-col-index='0']").focus();
  await page.keyboard.press("ArrowDown");
  await expect(grid.locator("[role=gridcell][data-row-index='1'][data-col-index='0']")).toBeFocused();
});

test("malformed virtual windows remain bounded and keyboard requests reach the host", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const grid = page.locator("#grid");
  await page.evaluate(async () => {
    const table = document.querySelector("#grid") as any;
    table.rows = Array.from({length: 250}, (_, index) => ({id: `row-${index}`, name: `Row ${index}`, amount: {decimal: String(index)}}));
    table.virtualized = true;
    table.virtualStart = Number.POSITIVE_INFINITY;
    table.virtualCount = Number.POSITIVE_INFINITY;
    table.overscan = Number.NaN;
    await table.updateComplete;
  });
  const mountedRows = grid.locator("[role=row][data-row-index]");
  await expect(mountedRows).toHaveCount(44);
  await expect(grid.locator("[role=gridcell][tabindex='0']")).toHaveCount(1);
  await grid.locator("[role=gridcell][data-row-index='43'][data-col-index='0']").focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => (window as any).dataFixture.events.findLast((event: any) => event.type === "aeliqo-table-window")?.detail)).toEqual({
    start: 44, count: 40, overscan: 4, row: 44, column: 0, reason: "keyboard",
  });
  await page.evaluate(async () => {
    const table = document.querySelector("#grid") as any;
    table.virtualStart = 44;
    await table.updateComplete;
  });
  await expect(grid.locator("[role=gridcell][data-row-index='44'][data-col-index='0']")).toBeFocused();
});

test("grid focus follows stable identity across reorder and falls back after removal", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  const grid = page.locator("#grid");
  await page.evaluate(async () => {
    const table = document.querySelector("#grid") as any;
    table.virtualized = false;
    await table.updateComplete;
  });
  await grid.locator("[role=gridcell][data-row-index='1'][data-col-index='0']").focus();
  await page.evaluate(async () => {
    const table = document.querySelector("#grid") as any;
    table.rows = [table.rows[1], table.rows[0], {id: "row-c", name: "Row C", amount: {decimal: "3"}}];
    await table.updateComplete;
  });
  await expect(grid.locator("[role=gridcell][data-row-index='0'][data-col-index='0']")).toHaveAttribute("tabindex", "0");
  await page.evaluate(async () => {
    const table = document.querySelector("#grid") as any;
    table.rows = table.rows.slice(1);
    await table.updateComplete;
  });
  await expect(grid.locator("[role=gridcell][tabindex='0']")).toHaveCount(1);
  await expect(grid.locator("[role=gridcell][data-row-index='0'][data-col-index='0']")).toHaveAttribute("tabindex", "0");
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

test("compound predicates and multiple clauses remain visible and intact on Apply", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  await page.evaluate(async () => {
    const filter = document.querySelector("#filter") as any;
    filter.fields = [
      {id: "name", label: "Name", type: "text"},
      {id: "amount", label: "Amount", type: "decimal"},
    ];
    filter.predicate = {
      op: "and",
      predicates: [
        {op: "compare", field: "name", comparison: "eq", value: "Ada"},
        {op: "compare", field: "amount", comparison: "gt", value: {decimal: "2.50"}},
      ],
    };
    filter.clauses = [];
    await filter.updateComplete;
  });
  const filter = page.locator("#filter");
  await expect(filter.locator("[part=clause]")).toHaveCount(2);
  await expect(filter.locator("select[part=field]").nth(0)).toHaveValue("name");
  await expect(filter.locator("select[part=field]").nth(1)).toHaveValue("amount");
  await expect(filter.locator("input[part=value]").nth(1)).toHaveValue("2.50");
  await filter.locator("button[part=apply]").click();
  await expect.poll(() => page.evaluate(() => (window as any).dataFixture.events.findLast((event: any) => event.type === "aeliqo-filter-change")?.detail.predicate)).toEqual({
    op: "and",
    predicates: [
      {op: "compare", field: "name", comparison: "eq", value: "Ada"},
      {op: "compare", field: "amount", comparison: "gt", value: {decimal: "2.50"}},
    ],
  });
});

test("explicit clauses stay visible and unsupported nested predicates stay read-only", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  await page.evaluate(async () => {
    const filter = document.querySelector("#filter") as any;
    filter.fields = [
      {id: "name", label: "Name", type: "text"},
      {id: "amount", label: "Amount", type: "decimal"},
    ];
    filter.predicate = undefined;
    filter.logical = "or";
    filter.clauses = [
      {field: "name", operator: "eq", value: "Ada"},
      {field: "amount", operator: "gt", value: "2.50"},
    ];
    await filter.updateComplete;
  });
  const filter = page.locator("#filter");
  await expect(filter.locator("[part=clause]")).toHaveCount(2);
  await expect(filter.locator("select[part=field]").nth(0)).toHaveValue("name");
  await expect(filter.locator("select[part=field]").nth(1)).toHaveValue("amount");

  await page.evaluate(async () => {
    const filter = document.querySelector("#filter") as any;
    filter.clauses = [];
    filter.predicate = {op: "not", predicate: {op: "compare", field: "name", comparison: "eq", value: "Ada"}};
    await filter.updateComplete;
  });
  await expect(filter.locator("[part=unsupported-predicate]")).toBeVisible();
  await expect(filter.locator("button[part=apply]")).toBeDisabled();
});

test("membership values preserve commas and inherited predicates are visibly read-only", async ({page}) => {
  await page.goto("/tests/data-components/index.html");
  await page.evaluate(async () => {
    const filter = document.querySelector("#filter") as any;
    filter.fields = [{id: "name", label: "Name", type: "text"}];
    filter.predicate = {op: "in", field: "name", values: ["ACME, Inc", "Other"]};
    filter.inherited = {
      op: "and",
      predicates: [
        {op: "compare", field: "name", comparison: "ne", value: "Blocked"},
        {op: "or", predicates: [
          {op: "compare", field: "name", comparison: "eq", value: "Ada"},
          {op: "compare", field: "name", comparison: "eq", value: "Lin"},
        ]},
      ],
    };
    await filter.updateComplete;
  });
  const filter = page.locator("#filter");
  await expect(filter.locator("input[part=value]")).toHaveValue('["ACME, Inc","Other"]');
  await expect(filter.locator("[part=inherited-predicate]")).toContainText("Inherited filter (read-only): name ne Blocked AND (name eq Ada OR name eq Lin)");
  await filter.locator("button[part=apply]").click();
  await expect.poll(() => page.evaluate(() => (window as any).dataFixture.events.findLast((event: any) => event.type === "aeliqo-filter-change")?.detail.predicate)).toEqual({
    op: "and",
    predicates: [
      {
        op: "and",
        predicates: [
          {op: "compare", field: "name", comparison: "ne", value: "Blocked"},
          {op: "or", predicates: [
            {op: "compare", field: "name", comparison: "eq", value: "Ada"},
            {op: "compare", field: "name", comparison: "eq", value: "Lin"},
          ]},
        ],
      },
      {op: "in", field: "name", values: ["ACME, Inc", "Other"]},
    ],
  });
});
