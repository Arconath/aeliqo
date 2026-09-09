import {expect, test, type Browser, type Page} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";

const ROUTE = "/docs/components/data.table/";

type Box = {readonly x: number; readonly y: number; readonly width: number; readonly height: number};
type LayoutEvidence = {
  readonly sidebarVersion: Box | null;
  readonly sidebarNavigation: Box | null;
  readonly propertiesHeading: Box | null;
  readonly apiTable: Box | null;
  readonly preview: Box | null;
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
    propertiesHeading: read(heading ?? null),
    apiTable: read(document.querySelector(".api-table")),
    preview: read(document.querySelector(".component-preview")),
  };
});

const expectStable = (before: Box | null, after: Box | null, name: string): void => {
  expect(before, `${name} must exist without JavaScript`).not.toBeNull();
  expect(after, `${name} must exist with JavaScript`).not.toBeNull();
  expect(Math.abs(after!.x - before!.x), `${name} x changed during hydration`).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.y - before!.y), `${name} y changed during hydration`).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.width - before!.width), `${name} width changed during hydration`).toBeLessThanOrEqual(1);
}

async function openNoScript(browser: Browser, baseURL: string): Promise<{page: Page; evidence: LayoutEvidence}> {
  const context = await browser.newContext({baseURL, javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto(ROUTE, {waitUntil: "load"});
  return {page, evidence: await boxes(page)};
}

test("component documentation keeps static structure stable through hydration", async ({browser}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string" || baseURL.length === 0) throw new Error("document-layout probe requires a Playwright baseURL");

  const noScript = await openNoScript(browser, baseURL);
  try {
    await expect(noScript.page.getByRole("heading", {name: "Table", exact: true})).toBeVisible();
    await expect(noScript.page.locator(".search-trigger")).toBeDisabled();
    await expect(noScript.page.locator(".component-preview")).toContainText("Interactive preview requires JavaScript.");
    await expect(noScript.page.getByRole("heading", {name: "Expected result", exact: true})).toBeVisible();
    await expect(noScript.page.locator("[data-example-code='table']")).toContainText("AeliqoTableElement");
    await expect(noScript.page.locator("[data-copy-example='table']")).toBeDisabled();
  } finally {
    await noScript.page.context().close();
  }

  const page = await browser.newPage();
  await page.goto(ROUTE, {waitUntil: "load"});
  await expect(page.getByRole("heading", {name: "Table", exact: true})).toBeVisible();
  await expect(page.locator(".search-trigger")).toBeEnabled();
  await expect(page.locator(".component-preview aeliqo-table")).toBeAttached();
  await expect(page.locator("[data-copy-example='table']")).toBeEnabled();
  await expect(page.getByRole("heading", {name: "Expected result", exact: true})).toBeVisible();
  await expect(page.locator(".api-table")).toBeVisible();
  await expect(page.locator(".search-trigger")).toHaveText("Search docs ⌘K");
  await page.locator(".search-trigger").click();
  await expect(page.locator("aeliqo-dialog dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  const hydrated = await boxes(page);
  expectStable(noScript.evidence.sidebarVersion, hydrated.sidebarVersion, "sidebar version control");
  expectStable(noScript.evidence.sidebarNavigation, hydrated.sidebarNavigation, "sidebar navigation");
  expectStable(noScript.evidence.propertiesHeading, hydrated.propertiesHeading, "properties heading");
  expectStable(noScript.evidence.apiTable, hydrated.apiTable, "API table");
  expectStable(noScript.evidence.preview, hydrated.preview, "preview shell");

  const output = testInfo.outputPath("document-layout-evidence.json");
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify({route: ROUTE, noScript: noScript.evidence, hydrated, claims: ["Position comparison is limited to this built data.table page at this viewport.", "This probe does not qualify a universal layout-shift or Core Web Vitals budget."]}, null, 2)}\n`, "utf8");
});
