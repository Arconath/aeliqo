# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: document-layout.spec.ts >> all component documentation routes preserve static content and hydration layout
- Location: tests/site/document-layout.spec.ts:102:5

# Error details

```
Error: /docs/components/visualization.trend/ preview shell height changed during hydration

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    29
```

# Test source

```ts
  1   | import {expect, test, type Page} from "@playwright/test";
  2   | import {mkdir, writeFile} from "node:fs/promises";
  3   | import {readFileSync} from "node:fs";
  4   | import {dirname, resolve} from "node:path";
  5   | 
  6   | const COMPONENT_CATALOG = JSON.parse(readFileSync(resolve(process.cwd(), "harness/components.json"), "utf8")) as {
  7   |   readonly components: readonly {readonly id: string; readonly name: string}[];
  8   | };
  9   | const COMPONENT_ROUTES = COMPONENT_CATALOG.components.map((component) => ({
  10  |   id: component.id.slice(component.id.indexOf(".") + 1),
  11  |   route: `/docs/components/${component.id}/`,
  12  |   name: component.name,
  13  | }));
  14  | const REPRESENTATIVE_ROUTE = "/docs/components/data.table/";
  15  | const HYDRATION_LAYOUT_SHIFT_BUDGET = 0.1;
  16  | 
  17  | type Box = {readonly x: number; readonly y: number; readonly width: number; readonly height: number};
  18  | type LayoutEvidence = {
  19  |   readonly sidebarVersion: Box | null;
  20  |   readonly sidebarNavigation: Box | null;
  21  |   readonly componentPreview: Box | null;
  22  |   readonly propertiesHeading: Box | null;
  23  |   readonly apiTable: Box | null;
  24  | };
  25  | type LayoutShiftEvidence = {
  26  |   readonly value: number;
  27  |   readonly hadRecentInput: boolean;
  28  |   readonly startTime: number;
  29  |   readonly sourceSelectors: readonly string[];
  30  | };
  31  | type LayoutObservation = {readonly route: string; readonly entries: readonly LayoutShiftEvidence[]};
  32  | type RouteEvidence = {
  33  |   readonly route: string;
  34  |   readonly component: string;
  35  |   readonly noScript: LayoutEvidence;
  36  |   readonly hydrated: LayoutEvidence;
  37  |   readonly layoutObservation: LayoutObservation;
  38  |   readonly hydrationLayoutShiftValue: number;
  39  | };
  40  | 
  41  | const boxes = async (page: Page): Promise<LayoutEvidence> => page.evaluate(() => {
  42  |   const read = (element: Element | null): Box | null => {
  43  |     if (element === null) return null;
  44  |     const {x, y, width, height} = element.getBoundingClientRect();
  45  |     return {x, y, width, height};
  46  |   };
  47  |   const heading = [...document.querySelectorAll(".reading h2")].find((element) => element.textContent?.trim() === "Properties and defaults");
  48  |   return {
  49  |     sidebarVersion: read(document.querySelector(".docs-sidebar > label")),
  50  |     sidebarNavigation: read(document.querySelector(".docs-sidebar > nav")),
  51  |     componentPreview: read(document.querySelector("[data-preview-mount]")),
  52  |     propertiesHeading: read(heading ?? null),
  53  |     apiTable: read(document.querySelector(".api-table")),
  54  |   };
  55  | });
  56  | 
  57  | const expectStable = (before: Box | null, after: Box | null, name: string): void => {
  58  |   expect(before, `${name} must exist without JavaScript`).not.toBeNull();
  59  |   expect(after, `${name} must exist with JavaScript`).not.toBeNull();
  60  |   expect(Math.abs(after!.x - before!.x), `${name} x changed during hydration`).toBeLessThanOrEqual(1);
  61  |   expect(Math.abs(after!.y - before!.y), `${name} y changed during hydration`).toBeLessThanOrEqual(1);
  62  |   expect(Math.abs(after!.width - before!.width), `${name} width changed during hydration`).toBeLessThanOrEqual(1);
> 63  |   expect(Math.abs(after!.height - before!.height), `${name} height changed during hydration`).toBeLessThanOrEqual(1);
      |                                                                                               ^ Error: /docs/components/visualization.trend/ preview shell height changed during hydration
  64  | };
  65  | 
  66  | async function assertNoScriptRoute(page: Page, component: typeof COMPONENT_ROUTES[number]): Promise<LayoutEvidence> {
  67  |   await page.goto(component.route, {waitUntil: "domcontentloaded"});
  68  |   await expect(page.getByRole("heading", {level: 1, name: component.name, exact: true})).toBeVisible();
  69  |   await expect(page.locator(".search-trigger")).toBeDisabled();
  70  |   await expect(page.locator("[data-component-preview] [data-preview-mount]")).toContainText("Interactive preview requires JavaScript.");
  71  |   await expect(page.locator("[data-component-preview]")).toContainText("Expected result");
  72  |   await expect(page.locator(`[data-example-code='${component.id}']`)).toContainText("import");
  73  |   await expect(page.locator(`[data-copy-example='${component.id}']`)).toBeDisabled();
  74  |   return boxes(page);
  75  | }
  76  | 
  77  | async function readLayoutObservation(page: Page): Promise<LayoutObservation> {
  78  |   return page.evaluate(() => {
  79  |     type RecordedShift = LayoutShiftEvidence;
  80  |     type LayoutShiftState = {
  81  |       readonly observer: PerformanceObserver;
  82  |       readonly records: RecordedShift[];
  83  |       readonly record: (entry: PerformanceEntry) => void;
  84  |     };
  85  |     const state = (window as Window & {__aeliqoLayoutShiftState?: LayoutShiftState}).__aeliqoLayoutShiftState;
  86  |     if (state === undefined) throw new Error("Layout-shift PerformanceObserver was not installed before navigation.");
  87  |     for (const entry of state.observer.takeRecords()) state.record(entry);
  88  |     state.observer.disconnect();
  89  |     return {route: location.pathname, entries: state.records};
  90  |   });
  91  | }
  92  | 
  93  | async function assertCopySuccess(page: Page, componentId: string): Promise<void> {
  94  |   const code = await page.locator(`[data-example-code='${componentId}']`).textContent();
  95  |   if (code === null) throw new Error(`Missing copy source for ${componentId}`);
  96  |   await page.locator("details.component-example summary").click();
  97  |   await page.locator(`[data-copy-example='${componentId}']`).click();
  98  |   await expect(page.locator("[data-copy-status]")).toHaveText("Example copied.");
  99  |   await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  100 | }
  101 | 
  102 | test("all component documentation routes preserve static content and hydration layout", async ({browser}, testInfo) => {
  103 |   const baseURL = testInfo.project.use.baseURL;
  104 |   if (typeof baseURL !== "string" || baseURL.length === 0) throw new Error("document-layout probe requires a Playwright baseURL");
  105 |   expect(COMPONENT_ROUTES, "the document-layout probe must enumerate the complete public catalog").toHaveLength(71);
  106 | 
  107 |   const noScriptContext = await browser.newContext({baseURL, javaScriptEnabled: false});
  108 |   const noScriptPage = await noScriptContext.newPage();
  109 |   const noScriptEvidence = new Map<string, LayoutEvidence>();
  110 |   try {
  111 |     for (const component of COMPONENT_ROUTES) {
  112 |       noScriptEvidence.set(component.route, await assertNoScriptRoute(noScriptPage, component));
  113 |     }
  114 |   } finally {
  115 |     await noScriptContext.close();
  116 |   }
  117 |   expect(noScriptEvidence.size, "every component route must have no-JavaScript evidence").toBe(COMPONENT_ROUTES.length);
  118 | 
  119 |   const context = await browser.newContext({baseURL, permissions: ["clipboard-read", "clipboard-write"]});
  120 |   const page = await context.newPage();
  121 |   await page.addInitScript(() => {
  122 |     type RecordedShift = {
  123 |       readonly value: number;
  124 |       readonly hadRecentInput: boolean;
  125 |       readonly startTime: number;
  126 |       readonly sourceSelectors: readonly string[];
  127 |     };
  128 |     type LayoutShiftEntry = PerformanceEntry & {
  129 |       readonly value?: number;
  130 |       readonly hadRecentInput?: boolean;
  131 |       readonly sources?: readonly {readonly node?: Node | null}[];
  132 |     };
  133 |     type LayoutShiftState = {
  134 |       readonly observer: PerformanceObserver;
  135 |       readonly records: RecordedShift[];
  136 |       readonly record: (entry: PerformanceEntry) => void;
  137 |     };
  138 |     const records: RecordedShift[] = [];
  139 |     const record = (entry: PerformanceEntry): void => {
  140 |       const shift = entry as LayoutShiftEntry;
  141 |       const sourceSelectors = (shift.sources ?? []).map(({node}) => {
  142 |         if (!(node instanceof Element)) return node?.nodeName ?? "unknown";
  143 |         const identity = node.id.length > 0 ? `#${node.id}` : "";
  144 |         const classes = typeof node.className === "string" && node.className.length > 0 ? `.${node.className.trim().split(/\s+/).join(".")}` : "";
  145 |         const preview = node.closest("[data-preview-mount]") !== null ? " [data-preview-mount]" : "";
  146 |         return `${node.localName}${identity}${classes}${preview}`;
  147 |       });
  148 |       records.push({
  149 |         value: shift.value ?? 0,
  150 |         hadRecentInput: shift.hadRecentInput ?? false,
  151 |         startTime: shift.startTime,
  152 |         sourceSelectors,
  153 |       });
  154 |     };
  155 |     const observer = new PerformanceObserver((list) => {
  156 |       for (const entry of list.getEntries()) record(entry);
  157 |     });
  158 |     observer.observe({type: "layout-shift", buffered: true});
  159 |     (window as Window & {__aeliqoLayoutShiftState?: LayoutShiftState}).__aeliqoLayoutShiftState = {observer, records, record};
  160 |   });
  161 | 
  162 |   const evidence: RouteEvidence[] = [];
  163 |   try {
```