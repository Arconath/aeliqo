import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { componentCatalog } from '../shared/catalog.js';

test('the public playground uses the app facade in guided and manual modes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await page.getByRole('button', { name: 'Manual controls' }).click();
  await page.locator('#pg-manual-step').selectOption('people-detail');
  await page.getByRole('button', { name: 'Apply intent' }).click();
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.screenshot({ path: 'artifacts/site-browser/playground-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('connected-agent mode never fabricates MCP, WebMCP, or BYOK evidence', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Connected agent' }).click();
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.getByRole('textbox', { name: 'Local BYOK prompt' })).toBeDisabled();
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText(/WebMCP|browser/i);
  expect(requests.some((url) => url.includes('/api/aeliqo/session'))).toBe(true);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('native WebMCP registers exactly the standard tools and renders through the current Region', async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map<string, unknown>();
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool: { name: string }) {
          tools.set(tool.name, tool);
        },
        async getTools() {
          return [...tools.values()];
        },
      },
    });
    Object.defineProperty(globalThis, '__aeliqoWebMcpTools', { value: tools });
  });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Connected agent' }).click();
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText('registered 3 tools');
  const result = await page.evaluate(async () => {
    const tools = (
      globalThis as typeof globalThis & {
        __aeliqoWebMcpTools: Map<string, { execute(input: unknown): Promise<unknown> }>;
      }
    ).__aeliqoWebMcpTools;
    const names = [...tools.keys()].sort();
    const context = await tools.get('aeliqo_context')?.execute({});
    const render = await tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'webmcp-engineering',
      kind: 'browse',
      resource: 'people',
      fields: ['name', 'team', 'location'],
      filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' },
    });
    return { names, context, render };
  });
  expect(result.names).toEqual(['aeliqo_act', 'aeliqo_context', 'aeliqo_render']);
  expect(result.context).toMatchObject({ ok: true, value: { state: 'accepted' } });
  expect(result.render).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  await expect(page.locator('#pg-region')).toContainText('Sam Rivera');
  await expect(page.locator('#pg-region')).not.toContainText('Ada Chen');
  await expect(page.getByRole('textbox', { name: 'Local BYOK prompt' })).toBeDisabled();
});

test('playground exports the selected scenario as an installable credential-free project archive', async ({ page }) => {
  await page.goto('/playground/');
  await page.locator('#pg-scenario').selectOption('knowledge');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('aeliqo-knowledge-example.zip');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const archive = Buffer.concat(chunks);
  expect(archive.readUInt32LE(0)).toBe(0x04034b50);
  expect(archive.includes(Buffer.from('src/main.ts'))).toBe(true);
  expect(archive.includes(Buffer.from('createAeliqoApp'))).toBe(true);
  expect(archive.toString('utf8')).not.toMatch(/api[_-]?key|bearer\s+[a-z0-9]/iu);
  await expect(page.locator('#pg-status')).toContainText('installable Knowledge project');
});

test('home, deep docs, search, theme and narrow playground remain navigable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.locator('#team').selectOption('Engineering');
  await expect(page.locator('#demo-status')).toContainText('2 of 4');
  await page.locator('#theme').selectOption('dark');
  await page.goto('/concepts/');
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
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-card-collection')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Inspector' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused();
  await page.screenshot({ path: 'artifacts/site-browser/playground-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('home proof uses the public adaptive facade and remains legible on narrow forced-color surfaces', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const records = page.locator('#home-demo');
  await expect(records).toHaveAttribute('role', 'region');
  await expect(records.locator('aeliqo-card-collection')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.locator('#team').selectOption('Engineering');
  await page.getByRole('button', { name: 'Render this intent', exact: true }).click();
  await expect(page.locator('#demo-status')).toContainText('2 of 4 synthetic people in an exact Result');
  await expect(records).toContainText('Sam Rivera');
  await expect(records).not.toContainText('Ada Chen');
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
  await page.locator('details').filter({ hasText: 'View the complete integration' }).locator('summary').click();
  await expect(page.locator('#demo-source')).toContainText('createAeliqoApp');
  await expect(page.locator('#demo-source')).toContainText("kind: 'browse'");
  await expect(page.locator('#demo-source')).not.toContainText('createTaskEvaluator');
});

test('every catalog route mounts its actual component and content remains readable without scripts', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const component of componentCatalog) {
    await page.goto(`/components/${component.id}/`);
    const id = component.id.slice(component.id.indexOf('.') + 1);
    await expect(page.locator(`[data-component-preview] aeliqo-${id}`).first()).toBeAttached();
    await expect(page.locator('[data-component-preview]')).toContainText('Expected result');
  }
  expect(errors).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(new URL('/concepts/', page.url()).href);
  await expect(staticPage.getByRole('heading', { name: 'How Aeliqo works', exact: true })).toBeVisible();
  await context.close();
  const response = await page.goto('/missing-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'GitHub private vulnerability reporting' })).toHaveAttribute(
    'href',
    'https://github.com/Arconath/aeliqo/security/advisories/new',
  );
  await expect(
    page.getByText(/does not publish a monitored security email address or response-time SLA/),
  ).toBeVisible();
  await page.goto('/legal/support/');
  await expect(page.getByText('does not promise a response time or commercial support agreement')).toBeVisible();
  await page.goto('/guides/data/');
  await expect(page.getByText(/local audit exporter accepts fixed event shapes/)).toBeVisible();
  expect(
    requests.some(
      (url) =>
        url.includes('/otel/v1/') || url.includes('googletagmanager.com') || url.includes('google-analytics.com'),
    ),
  ).toBe(false);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});
