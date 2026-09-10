import {expect, test} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const COMPONENT_ROUTES = (JSON.parse(readFileSync(resolve(process.cwd(), "harness/components.json"), "utf8")) as {
  readonly components: readonly {readonly id: string; readonly name: string}[];
}).components.map(({id}) => `/docs/components/${id}/`);

const GETTING_STARTED_ROUTES = [
  "/docs/getting-started/standalone/",
  "/docs/getting-started/local/",
  "/docs/getting-started/http/",
  "/docs/getting-started/region/",
  "/docs/getting-started/agent/",
] as const;

test("documentation information architecture exposes distinct adoption routes", async ({page}) => {
  for (const route of ["/docs/", ...GETTING_STARTED_ROUTES, "/docs/concepts/", "/docs/integration/", "/docs/production/"]) {
    await page.goto(route);
    await expect(page.locator(".reading h1")).toBeVisible();
    await expect(page.locator(".docs-sidebar")).toBeVisible();
  }

  await page.goto("/docs/");
  for (const route of GETTING_STARTED_ROUTES) await expect(page.locator(`.reading a[href="${route}"]`).first()).toBeVisible();
  await expect(page.locator(".reading a[href=\"/docs/concepts/\"]").first()).toBeVisible();
  await expect(page.locator(".reading a[href=\"/docs/integration/\"]").first()).toBeVisible();
  await expect(page.locator(".reading a[href=\"/docs/production/\"]").first()).toBeVisible();
});

test("documentation search keeps keyboard, query, no-result, and fallback paths", async ({browser, page}) => {
  await page.goto("/docs/concepts/");
  await expect(page.locator(".docs-search-tools .docs-search-fallback")).toBeHidden();
  await expect(page.locator(".search-trigger")).toBeVisible();
  await page.keyboard.press("Control+K");
  await expect(page.locator("#docs-search-dialog").getByRole("dialog")).toBeVisible();
  const field = page.locator("#docs-search-dialog input.docs-search-field");
  await field.fill("table");
  const rankedLinks = page.locator("#docs-search-dialog .search-results a");
  await expect(rankedLinks.first()).toHaveAttribute("href", "/docs/components/data.table/");
  await expect(rankedLinks.first().locator("strong")).toHaveText("Table");
  await expect(page.locator("#docs-search-dialog .search-results a[href='/docs/components/navigation.tabs/']")).toHaveCount(0);
  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations.filter(violation => ["landmark-no-duplicate-banner", "landmark-unique", "region"].includes(violation.id))).toEqual([]);
  await field.fill("meaning");
  await expect(page).toHaveURL(/\?q=meaning$/);
  await expect(page.locator("#docs-search-dialog").getByRole("link").first()).toBeVisible();
  await field.fill("no-such-aeliqo-page");
  await expect(page.locator("#docs-search-dialog")).toContainText("No pages found");

  const noScriptContext = await browser.newContext({javaScriptEnabled: false});
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto("/docs/search/?q=meaning");
    await expect(noScriptPage.getByRole("heading", {level: 1, name: "Search documentation"})).toBeVisible();
    await expect(noScriptPage.locator("form.docs-search-fallback").first()).toHaveAttribute("action", "/docs/search/");
    await expect(noScriptPage.locator(".search-fallback-links a").first()).toBeVisible();
    await noScriptPage.goto("/docs/components/data.table/");
    await expect(noScriptPage.locator(".docs-search-tools .docs-search-fallback")).toBeVisible();
    await expect(noScriptPage.locator(".search-trigger")).toBeHidden();
  } finally {
    await noScriptContext.close();
  }
});

test("component pages expose source-backed adoption details", async ({page}) => {
  await page.goto("/docs/components/data.table/");
  for (const heading of ["Purpose", "Do / don't", "Dependencies", "Controlled and uncontrolled use", "Semantic elements and accessibility hooks", "Sizing and adaptation", "Performance boundary", "Changelog", "Input fixture", "States", "Keyboard behavior", "Events", "Properties and defaults"]) {
    await expect(page.getByRole("heading", {name: heading, exact: true})).toBeVisible();
  }
  const preview = await page.locator("[data-preview-mount]").boundingBox();
  const purpose = await page.getByRole("heading", {name: "Purpose", exact: true}).boundingBox();
  expect(preview).not.toBeNull();
  expect(purpose).not.toBeNull();
  expect(preview!.y).toBeLessThan(purpose!.y);
  await expect(page.getByRole("heading", {name: "Sizing and adaptation", exact: true}).locator("xpath=following-sibling::p[1]")).toContainText("grid-template-columns");
  await expect(page.locator(".component-details")).not.toContainText("${");
  await expect(page.locator(".component-details")).not.toContainText("slice(0");
  await expect(page.locator(".component-details")).toContainText("packages/web/src/elements/aeliqo-table.ts");
  await expect(page.locator(".component-details")).toContainText("do not establish a controlled or uncontrolled contract");
  await expect(page.locator("[data-example-code=table]")).toContainText("import");

  await page.goto("/docs/components/compound.form-flow/");
  await expect(page.getByRole("heading", {name: "Performance boundary", exact: true}).locator("xpath=following-sibling::ul[1]")).not.toContainText("MAX_COMPARISON");
  await page.goto("/docs/components/compound.comparison/");
  await expect(page.getByRole("heading", {name: "Performance boundary", exact: true}).locator("xpath=following-sibling::ul[1]")).toContainText("MAX_COMPARISON_KEYS");
});

test("narrow documentation starts with the requested article before navigation", async ({browser, page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await page.goto("/docs/components/data.table/");
  const heading = await page.getByRole("heading", {level: 1, name: "Table", exact: true}).boundingBox();
  const sidebar = await page.locator(".docs-sidebar").boundingBox();
  expect(heading).not.toBeNull();
  expect(sidebar).not.toBeNull();
  expect(heading!.y).toBeLessThan(800);
  expect(heading!.y).toBeLessThan(sidebar!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);

  const noScriptContext = await browser.newContext({javaScriptEnabled: false, viewport: {width: 360, height: 800}});
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto("/docs/components/data.table/");
    const noScriptHeading = await noScriptPage.getByRole("heading", {level: 1, name: "Table", exact: true}).boundingBox();
    const noScriptSidebar = await noScriptPage.locator(".docs-sidebar").boundingBox();
    expect(noScriptHeading).not.toBeNull();
    expect(noScriptSidebar).not.toBeNull();
    expect(noScriptHeading!.y).toBeLessThan(800);
    expect(noScriptHeading!.y).toBeLessThan(noScriptSidebar!.y);
    expect(await noScriptPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await noScriptContext.close();
  }
});

test("all generated component routes fit 320px and 360px without page overflow", async ({browser}) => {
  test.setTimeout(180_000);
  for (const width of [320, 360]) {
    const hydratedContext = await browser.newContext({viewport: {width, height: 800}});
    const hydratedPage = await hydratedContext.newPage();
    try {
      for (const route of COMPONENT_ROUTES) {
        await hydratedPage.goto(route);
        await expect(hydratedPage.locator(".reading h1")).toBeVisible();
        await expect.poll(() => hydratedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      await hydratedContext.close();
    }

    const noScriptContext = await browser.newContext({javaScriptEnabled: false, viewport: {width, height: 800}});
    const noScriptPage = await noScriptContext.newPage();
    try {
      for (const route of COMPONENT_ROUTES) {
        await noScriptPage.goto(route);
        await expect(noScriptPage.locator(".reading h1")).toBeVisible();
        expect(await noScriptPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      await noScriptContext.close();
    }
  }
});

test("scrollable code remains focusable and named across static, hydrated, and opened states", async ({browser, page}) => {
  await page.goto("/docs/getting-started/");
  const install = page.locator(".reading > pre");
  await expect(install).toHaveAttribute("tabindex", "0");
  await install.focus();
  await expect(install).toBeFocused();
  const recordListExample = page.locator('div[data-example="record-list"] > pre');
  await expect(recordListExample).toHaveAttribute("tabindex", "0");
  await recordListExample.focus();
  await expect(recordListExample).toBeFocused();
  expect((await new AxeBuilder({page}).include("main").analyze()).violations).toEqual([]);

  const noScriptContext = await browser.newContext({javaScriptEnabled: false, viewport: {width: 360, height: 800}});
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto("/docs/getting-started/");
    const staticInstall = noScriptPage.locator(".reading > pre");
    await expect(staticInstall).toHaveAttribute("tabindex", "0");
    await staticInstall.focus();
    await expect(staticInstall).toBeFocused();

    await noScriptPage.goto("/docs/components/data.table/");
    const noScriptDetails = noScriptPage.locator("details.component-example");
    await noScriptDetails.evaluate((element) => { (element as HTMLDetailsElement).open = true; });
    const noScriptExample = noScriptDetails.locator("pre");
    await expect(noScriptExample).toHaveAttribute("tabindex", "0");
    await noScriptExample.focus();
    await expect(noScriptExample).toBeFocused();
  } finally {
    await noScriptContext.close();
  }

  await page.goto("/docs/components/data.table/");
  const details = page.locator("details.component-example");
  await details.locator("summary").click();
  const example = details.locator("pre");
  await expect(example).toHaveAttribute("tabindex", "0");
  await example.focus();
  await expect(example).toBeFocused();
  const apiPre = page.locator(".code-scroll > pre");
  await expect(apiPre).toHaveAttribute("tabindex", "0");
  await expect(apiPre).not.toHaveAttribute("aria-label");
  await expect(page.locator(".code-scroll")).toHaveAttribute("role", "region");
  await expect(page.locator(".code-scroll")).toHaveAttribute("aria-labelledby", "public-api-heading");
  const openedA11y = await new AxeBuilder({page}).include("main").analyze();
  expect(openedA11y.violations).toEqual([]);
});

test("every generated component example keeps its code focusable when opened", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width: 360, height: 800});
  for (const route of COMPONENT_ROUTES) {
    await page.goto(route);
    const details = page.locator("details.component-example");
    await details.evaluate((element) => { (element as HTMLDetailsElement).open = true; });
    const pre = details.locator("pre");
    await expect(pre).toHaveAttribute("tabindex", "0");
  }
});

test("homepage code disclosures remain focusable at 320px", async ({page}) => {
  await page.setViewportSize({width: 320, height: 900});
  await page.goto("/");
  for (const details of [page.locator("details.release-install"), page.locator("details").filter({hasText: "View the component source"})]) {
    await details.locator("summary").click();
    const pre = details.locator("pre");
    await expect(pre).toHaveAttribute("tabindex", "0");
    await pre.focus();
    await expect(pre).toBeFocused();
  }
  const accessibility = await new AxeBuilder({page}).include("main").analyze();
  expect(accessibility.violations).toEqual([]);
});

test("homepage result output remains a named accessible section after evaluation", async ({page}) => {
  await page.goto("/");
  await page.locator("#team").selectOption("Engineering");
  await page.getByRole("button", {name: "Request a local result", exact: true}).click();
  const result = page.locator("#demo-result");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("aria-labelledby", "demo-result-title");
  await expect(page.getByRole("region", {name: "Exact supplied output", exact: true})).toBeVisible();
  const accessibility = await new AxeBuilder({page}).include("main").analyze();
  expect(accessibility.violations).toEqual([]);
});

test("shown analytics consent uses an accessible dialog role", async ({page}) => {
  await page.goto("/docs/");
  const consent = page.locator("#analytics-consent");
  await expect(consent).toHaveAttribute("role", "dialog");
  await consent.evaluate((element) => { element.removeAttribute("hidden"); });
  await expect(consent).toBeVisible();
  await expect(consent.getByRole("button", {name: "Allow analytics", exact: true})).toBeVisible();
  const accessibility = await new AxeBuilder({page}).include("#analytics-consent").analyze();
  expect(accessibility.violations).toEqual([]);
});
