import {expect, test} from "@playwright/test";

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
  await page.keyboard.press("Control+K");
  await expect(page.locator("#docs-search-dialog").getByRole("dialog")).toBeVisible();
  const field = page.locator("#docs-search-dialog input.docs-search-field");
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
  } finally {
    await noScriptContext.close();
  }
});

test("component pages expose source-backed adoption details", async ({page}) => {
  await page.goto("/docs/components/data.table/");
  for (const heading of ["Purpose", "Do / don't", "Dependencies", "Controlled and uncontrolled use", "Semantic elements and accessibility hooks", "Sizing and adaptation", "Performance boundary", "Changelog", "Input fixture", "States", "Keyboard behavior", "Events", "Properties and defaults"]) {
    await expect(page.getByRole("heading", {name: heading, exact: true})).toBeVisible();
  }
  await expect(page.locator("[data-example-code=table]")).toContainText("import");
});
