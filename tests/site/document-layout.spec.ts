import {expect, test, type Browser, type Page} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";

const COMPONENT_CATALOG = JSON.parse(readFileSync(resolve(process.cwd(), "harness/components.json"), "utf8")) as {
  readonly components: readonly {readonly id: string; readonly name: string}[];
};
const COMPONENT_ROUTES = COMPONENT_CATALOG.components.map((component) => ({
  id: component.id.slice(component.id.indexOf(".") + 1),
  route: `/docs/components/${component.id}/`,
  name: component.name,
}));
const REPRESENTATIVE_ROUTE = "/docs/components/data.table/";
const HYDRATION_LAYOUT_SHIFT_BUDGET = 0.1;

type Box = {readonly x: number; readonly y: number; readonly width: number; readonly height: number};
type LayoutEvidence = {
  readonly sidebarVersion: Box | null;
  readonly sidebarNavigation: Box | null;
  readonly componentPreview: Box | null;
  readonly propertiesHeading: Box | null;
  readonly apiTable: Box | null;
};
type LayoutShiftEvidence = {
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly startTime: number;
  readonly sourceSelectors: readonly string[];
};
type LayoutObservation = {readonly route: string; readonly entries: readonly LayoutShiftEvidence[]};
type RouteEvidence = {
  readonly route: string;
  readonly component: string;
  readonly noScript?: LayoutEvidence;
  readonly hydrated: LayoutEvidence;
  readonly layoutObservation: LayoutObservation;
  readonly hydrationLayoutShiftValue: number;
};

const boxes = async (page: Page): Promise<LayoutEvidence> => page.evaluate(() => {
  const read = (element: Element | null): Box | null => {
    if (element === null) return null;
    const {x, y, width, height} = element.getBoundingClientRect();
    return {x, y, width, height};
  };
  const heading = [...document.querySelectorAll(".reading h2")].find((element) => element.textContent?.trim() === "Properties and defaults");
  return {
    sidebarVersion: read(document.querySelector(".docs-sidebar > label")),
    sidebarNavigation: read(document.querySelector(".docs-sidebar > nav")),
    componentPreview: read(document.querySelector("[data-preview-mount]")),
    propertiesHeading: read(heading ?? null),
    apiTable: read(document.querySelector(".api-table")),
  };
});

const expectStable = (before: Box | null, after: Box | null, name: string): void => {
  expect(before, `${name} must exist without JavaScript`).not.toBeNull();
  expect(after, `${name} must exist with JavaScript`).not.toBeNull();
  expect(Math.abs(after!.x - before!.x), `${name} x changed during hydration`).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.y - before!.y), `${name} y changed during hydration`).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.width - before!.width), `${name} width changed during hydration`).toBeLessThanOrEqual(1);
};

async function openNoScript(browser: Browser, baseURL: string): Promise<{page: Page; evidence: LayoutEvidence}> {
  const context = await browser.newContext({baseURL, javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto(REPRESENTATIVE_ROUTE, {waitUntil: "load"});
  return {page, evidence: await boxes(page)};
}

async function readLayoutObservation(page: Page): Promise<LayoutObservation> {
  return page.evaluate(() => {
    type RecordedShift = LayoutShiftEvidence;
    type LayoutShiftState = {
      readonly observer: PerformanceObserver;
      readonly records: RecordedShift[];
      readonly record: (entry: PerformanceEntry) => void;
    };
    const state = (window as Window & {__aeliqoLayoutShiftState?: LayoutShiftState}).__aeliqoLayoutShiftState;
    if (state === undefined) throw new Error("Layout-shift PerformanceObserver was not installed before navigation.");
    for (const entry of state.observer.takeRecords()) state.record(entry);
    state.observer.disconnect();
    return {route: location.pathname, entries: state.records};
  });
}

test("all component documentation routes preserve static content and hydration layout", async ({browser}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string" || baseURL.length === 0) throw new Error("document-layout probe requires a Playwright baseURL");
  expect(COMPONENT_ROUTES, "the document-layout probe must enumerate the complete public catalog").toHaveLength(71);

  const noScript = await openNoScript(browser, baseURL);
  try {
    await expect(noScript.page.getByRole("heading", {name: "Table", exact: true})).toBeVisible();
    await expect(noScript.page.locator(".search-trigger")).toBeDisabled();
    await expect(noScript.page.locator("[data-component-preview] [data-preview-mount]")).toContainText("Interactive preview requires JavaScript.");
    await expect(noScript.page.locator("[data-component-preview]")).toContainText("Expected result");
    await expect(noScript.page.locator("[data-example-code='table']")).toContainText("AeliqoTableElement");
    await expect(noScript.page.locator("[data-copy-example='table']")).toBeDisabled();
  } finally {
    await noScript.page.context().close();
  }

  const page = await browser.newPage();
  await page.addInitScript(() => {
    type RecordedShift = {
      readonly value: number;
      readonly hadRecentInput: boolean;
      readonly startTime: number;
      readonly sourceSelectors: readonly string[];
    };
    type LayoutShiftEntry = PerformanceEntry & {
      readonly value?: number;
      readonly hadRecentInput?: boolean;
      readonly sources?: readonly {readonly node?: Node | null}[];
    };
    type LayoutShiftState = {
      readonly observer: PerformanceObserver;
      readonly records: RecordedShift[];
      readonly record: (entry: PerformanceEntry) => void;
    };
    const records: RecordedShift[] = [];
    const record = (entry: PerformanceEntry): void => {
      const shift = entry as LayoutShiftEntry;
      const sourceSelectors = (shift.sources ?? []).map(({node}) => {
        if (!(node instanceof Element)) return node?.nodeName ?? "unknown";
        const identity = node.id.length > 0 ? `#${node.id}` : "";
        const classes = typeof node.className === "string" && node.className.length > 0 ? `.${node.className.trim().split(/\s+/).join(".")}` : "";
        const preview = node.closest("[data-preview-mount]") !== null ? " [data-preview-mount]" : "";
        return `${node.localName}${identity}${classes}${preview}`;
      });
      records.push({
        value: shift.value ?? 0,
        hadRecentInput: shift.hadRecentInput ?? false,
        startTime: shift.startTime,
        sourceSelectors,
      });
    };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record(entry);
    });
    observer.observe({type: "layout-shift", buffered: true});
    (window as Window & {__aeliqoLayoutShiftState?: LayoutShiftState}).__aeliqoLayoutShiftState = {observer, records, record};
  });

  const evidence: RouteEvidence[] = [];
  try {
    for (const component of COMPONENT_ROUTES) {
      await page.goto(component.route, {waitUntil: "load"});
      await expect(page.getByRole("heading", {level: 1, name: component.name, exact: true})).toBeVisible();
      await expect(page.locator(`[data-component-preview] aeliqo-${component.id}`)).toBeAttached();
      await expect(page.locator("[data-component-preview]")).toContainText("Expected result");
      await expect(page.locator(`[data-copy-example='${component.id}']`)).toBeEnabled();
      await page.evaluate(async (tagName) => {
        await customElements.whenDefined(tagName);
        const element = document.querySelector<HTMLElement>(`[data-preview-mount] ${tagName}`) as (HTMLElement & {updateComplete?: Promise<unknown>}) | null;
        await element?.updateComplete;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }, `aeliqo-${component.id}`);

      const hydrated = await boxes(page);
      const layoutObservation = await readLayoutObservation(page);
      expect(layoutObservation.route, `${component.route} layout observer must be fresh for the current navigation`).toBe(component.route);
      const hydrationLayoutShiftValue = layoutObservation.entries
        .filter((entry) => !entry.hadRecentInput)
        .reduce((sum, entry) => sum + entry.value, 0);
      expect(hydrationLayoutShiftValue, `${component.route} controlled hydration layout shift exceeded the ${HYDRATION_LAYOUT_SHIFT_BUDGET} budget`).toBeLessThanOrEqual(HYDRATION_LAYOUT_SHIFT_BUDGET);
      evidence.push({
        route: component.route,
        component: component.id,
        ...(component.route === REPRESENTATIVE_ROUTE ? {noScript: noScript.evidence} : {}),
        hydrated,
        layoutObservation,
        hydrationLayoutShiftValue,
      });
    }
  } finally {
    await page.close();
  }

  const representative = evidence.find((entry) => entry.route === REPRESENTATIVE_ROUTE);
  if (representative === undefined) throw new Error(`Missing layout evidence for ${REPRESENTATIVE_ROUTE}`);
  if (representative.noScript === undefined) throw new Error(`Missing no-JavaScript evidence for ${REPRESENTATIVE_ROUTE}`);
  expectStable(representative.noScript.sidebarVersion, representative.hydrated.sidebarVersion, "sidebar version control");
  expectStable(representative.noScript.sidebarNavigation, representative.hydrated.sidebarNavigation, "sidebar navigation");
  expectStable(representative.noScript.componentPreview, representative.hydrated.componentPreview, "preview shell");
  expectStable(representative.noScript.propertiesHeading, representative.hydrated.propertiesHeading, "properties heading");
  expectStable(representative.noScript.apiTable, representative.hydrated.apiTable, "API table");

  const output = testInfo.outputPath("document-layout-evidence.json");
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify({
    routeCount: COMPONENT_ROUTES.length,
    routes: evidence,
    layoutShiftBudget: HYDRATION_LAYOUT_SHIFT_BUDGET,
    claims: [
      "All 71 generated component routes were loaded with JavaScript and checked for their real component mount and expected-result content.",
      "The browser PerformanceObserver recorded layout-shift entries during each controlled JavaScript hydration navigation, retaining source selectors and summing all entries without recent input against a 0.1 per-route observation budget; this is not a p75 field CLS claim.",
      "No-JavaScript structure and position comparison is retained for the representative data.table route at this viewport.",
    ],
  }, null, 2)}\n`, "utf8");
});
