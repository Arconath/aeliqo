import {expect, test} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
