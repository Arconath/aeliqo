import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { componentCatalog } from '../shared/catalog.js';
test('real employee tasks, named periods, fixed cohort, view rejection and drafts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/playground/');
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await expect(page.locator('aeliqo-region aeliqo-table')).toBeVisible();
  await page.getByRole('button', { name: 'Rank absence days', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('demo.needs-meaning');
  await expect(page.locator('aeliqo-region')).toBeVisible();
  await page.getByRole('button', { name: 'Define absence days', exact: true }).click();
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await page.locator('#play-team').selectOption('Engineering');
  await expect(page.locator('#play-status')).toContainText('2 result rows');
  await page.getByRole('button', { name: 'Freeze current people', exact: true }).click();
  await expect(page.locator('#cohort-status')).toContainText('2 people');
  await page.getByRole('button', { name: 'Trend fixed cohort', exact: true }).click();
  await expect(page.locator('aeliqo-trend')).toBeVisible();
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
  await expect(page.locator('aeliqo-region')).toHaveCount(2);
  await expect(page.locator('#play-status')).toContainText('2 complete outputs');
  await page.getByRole('button', { name: 'Inspect records', exact: true }).click();
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await page.locator('#result-view').selectOption('bar');
  await expect(page.getByRole('alert')).toContainText('unsupported-view');
  await expect(page.locator('aeliqo-region')).toHaveCount(1);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.locator('#task-draft').fill('{"unfinished":');
  await page.getByRole('button', { name: 'Evaluate task', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(page.locator('#task-draft')).toHaveValue('{"unfinished":');
  await page.keyboard.press('Escape');
  await expect(page.locator('#source-panel')).toBeHidden();
  await expect(page.locator('#source-toggle')).toBeFocused();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.locator('#task-draft')).toHaveValue('{"unfinished":');
  await page.locator('#source-resize').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#source-resize')).toHaveAttribute('aria-valuenow', '336');
  await page.screenshot({ path: 'artifacts/site-browser/playground-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('commerce compare, detail and local form remain usable without model access', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/playground/');
  await page.locator('#dataset').selectOption('products');
  await expect(page.locator('#commerce')).toBeVisible();
  await expect(page.locator('aeliqo-comparison')).toContainText('Field notebook');
  await expect(page.locator('aeliqo-detail')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Nino');
  await page.getByRole('textbox', { name: 'Enquiry note', exact: true }).fill('Please compare these.');
  await page.getByRole('button', { name: 'Review local enquiry', exact: true }).click();
  await expect(page.locator('#commerce-form [role=status]')).toContainText('Draft reviewed for Nino');
  await page.getByLabel('First product', { exact: true }).selectOption('lamp');
  await expect(page.getByRole('textbox', { name: 'Enquiry note', exact: true })).toHaveValue('Please compare these.');
  expect(errors).toEqual([]);
});
test('MCP, WebMCP, and BYOK playground paths produce bounded local evidence', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  const mcpShortcut = page.getByRole('button', { name: 'MCP Discover and invoke a scoped server tool' });
  const webMcpShortcut = page.getByRole('button', { name: 'WebMCP Register a tool with the browser host' });
  const byokShortcut = page.getByRole('button', { name: 'BYOK Run a bounded host-owned model loop' });
  await expect(mcpShortcut).toBeVisible();
  await expect(webMcpShortcut).toBeVisible();
  await expect(byokShortcut).toBeVisible();
  await mcpShortcut.click();
  await expect(page.locator('#agent-output')).toContainText('"protocol": "MCP"');
  await expect(page.locator('#agent-output')).toContainText('"transport": "mcp"');
  await webMcpShortcut.click();
  await expect(page.locator('#agent-output')).toContainText('"protocol": "WebMCP"');
  await expect(page.locator('#agent-output')).toContainText('"registration"');
  await byokShortcut.click();
  await expect(page.locator('#agent-output')).toContainText('"protocol": "BYOK"');
  await expect(page.locator('#agent-output')).toContainText('"stop": "text-ready"');
  await expect(page.locator('#agent-output')).toContainText('"toolCalls": 1');
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});
test('home, deep docs, search, theme and narrow playground remain navigable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#team').selectOption('Engineering');
  await expect(page.locator('#demo-status')).toContainText('2 of 4');
  await page.locator('#theme').selectOption('dark');
  await page.goto('/docs/concepts/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Watch the contract become a view.', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Search docs' }).click();
  await page.getByRole('searchbox').fill('nonsensezzzzz');
  await expect(page.locator('aeliqo-dialog')).toContainText('No pages found');
  await page.getByRole('searchbox').fill('meaning');
  await expect(page.locator('aeliqo-dialog').getByRole('link').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/playground/');
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Define absence days', exact: true }).click();
  await expect(page.locator('#workflow-meter')).toContainText('2 of 4');
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.locator('#inspector-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector-toggle')).toBeFocused();
  await page.screenshot({ path: 'artifacts/site-browser/playground-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('home result proof keeps narrow records keyboard-scrollable and forced-colors legible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const records = page.locator('#home-demo');
  await expect(records).toHaveAttribute('role', 'region');
  await expect(records).toHaveAttribute('tabindex', '0');
  const geometry = await records.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    scrollLeft: element.scrollLeft,
  }));
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  await expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await records.focus();
  await expect(records).toBeFocused();
  await page.keyboard.press('ArrowRight');
  expect(await records.evaluate((element) => element.scrollLeft)).toBeGreaterThan(geometry.scrollLeft);
  await page.locator('#team').selectOption('Engineering');
  await page.getByRole('button', { name: 'Request a local result', exact: true }).click();
  await expect(page.locator('#demo-status')).toContainText('2 of 4 synthetic people in the exact Result');
  await expect(page.locator('aeliqo-metric')).toBeVisible();
  await expect(page.locator('aeliqo-bar')).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.locator('[data-flow-step="view"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(forced.color).not.toBe('rgb(17, 24, 39)');
  expect(forced.background).not.toBe('rgb(0, 0, 0)');
  expect(
    (await new AxeBuilder({ page }).include('main').analyze()).violations.filter(({ id }) => id === 'color-contrast'),
  ).toEqual([]);
  await expect(page.getByText('Install Aeliqo 0.1.0', { exact: true })).toBeVisible();
  await page.getByText('Install Aeliqo 0.1.0', { exact: true }).click();
  await expect(page.locator('.release-install pre code')).toContainText('@aeliqo/core@0.1.0');
  await page.locator('details').filter({ hasText: 'View the component source' }).locator('summary').click();
  await expect(page.locator('#demo-source')).toContainText('await records.evaluate');
  await expect(page.locator('#demo-source')).not.toContainText('function selectedRows');
});
test('every catalog route mounts its actual component and content remains readable without scripts', async ({
  page,
  browser,
}) => {
  const catalog = componentCatalog;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const component of catalog) {
    await page.goto(`/docs/components/${component.id}/`);
    const id = component.id.slice(component.id.indexOf('.') + 1);
    await expect(page.locator(`[data-component-preview] aeliqo-${id}`).first()).toBeAttached();
    await expect(page.locator('[data-component-preview]')).toContainText('Expected result');
  }
  expect(errors).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(new URL('/docs/concepts/', page.url()).href);
  await expect(staticPage.getByRole('heading', { name: 'Core concepts', exact: true })).toBeVisible();
  await context.close();
  const response = await page.goto('/missing-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
});
test('desktop panels collapse to one focused narrow drawer on resize', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.locator('#source-panel')).toBeVisible();
  await expect(page.locator('#inspector-panel')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('[aria-modal=true]')).toHaveCount(1);
  await expect(page.locator('#source-panel')).toBeHidden();
  await expect(page.locator('#source-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#inspector-tab')).toBeFocused();
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await expect(page.locator('#inspector-toggle')).toBeFocused();
  await expect(page.locator('.playground-main')).not.toHaveAttribute('inert', '');
});
test('legal and support pages state the offline, reporting and commercial boundaries without default egress', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#analytics-consent')).toBeHidden();
  await page.goto('/legal/privacy/');
  await expect(page.getByText('Filtering and evaluation run in the browser.')).toBeVisible();
  await expect(page.getByText(/asks before loading them/)).toBeVisible();
  await page.goto('/legal/license/');
  await expect(page.getByText(/does not depend on a license network service/)).toBeVisible();
  await page.goto('/legal/security/');
  const privateReport = page.getByRole('link', { name: 'GitHub private vulnerability reporting' });
  await expect(privateReport).toHaveAttribute('href', 'https://github.com/Arconath/aeliqo/security/advisories/new');
  await expect(
    page.getByText(/does not publish a monitored security email address or response-time SLA/),
  ).toBeVisible();
  await page.goto('/legal/support/');
  await expect(page.getByText('does not promise a response time or commercial support agreement')).toBeVisible();
  await page.goto('/docs/data/');
  await expect(page.getByText(/local audit exporter accepts fixed event shapes/)).toBeVisible();
  expect(
    requests.some(
      (url) =>
        url.includes('/otel/v1/') || url.includes('googletagmanager.com') || url.includes('google-analytics.com'),
    ),
  ).toBe(false);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});
