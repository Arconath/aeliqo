import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { componentCatalog } from '../shared/catalog.js';

test('the public playground uses the app facade without AI and through structured intents', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/playground/');
  await expect(page.locator('#pg-boot')).toBeHidden();
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('#pg-journey-intent')).toHaveText('Browse people');
  await expect(page.locator('#pg-journey-result')).toHaveText('Evaluated');
  await expect(page.locator('#pg-journey-view')).toHaveText('Table');
  await expect(page.locator('#pg-receipt-state')).toBeHidden();
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await page.getByText('Run a structured intent', { exact: true }).click();
  await page.locator('#pg-manual-step').selectOption('people-detail');
  await page.getByRole('button', { name: 'Apply intent' }).click();
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  await expect(page.locator('#pg-journey-view')).toHaveText('Detail');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.screenshot({ path: 'artifacts/site-browser/playground-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('public journeys show Jakarta people, daily attendance, and a composed workspace without AI', async ({ page }) => {
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'People in Jakarta' }).click();
  await expect(page.locator('#pg-committed-filter')).toContainText('Jakarta');
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await expect(page.locator('aeliqo-table')).not.toContainText('Sam Rivera');
  await page.getByRole('button', { name: 'Daily attendance' }).click();
  await expect(page.locator('[data-testid="attendance-status"]')).toContainText('renderer-ready');
  await expect(page.locator('[data-testid="period"]')).toContainText('Asia/Jakarta');
  await expect(page.locator('[data-testid="daily-values"]')).toContainText('2026-09-02: 0.5');
  await page.getByRole('button', { name: 'Compare attendance metrics' }).click();
  await expect(page.locator('#metric-choice')).toBeVisible();
  await expect(page.locator('#pg-journey-result')).toHaveText('Needs a choice');
  await expect(page.locator('#pg-journey-view')).toHaveText('Choose a metric');
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page.locator('[data-inspector="intent"]').click();
  await expect(page.locator('#pg-inspector-content')).toContainText('Analyze daily attendance');
  await page.locator('[data-inspector="diagnostics"]').click();
  await expect(page.locator('#pg-inspector-content')).toContainText('needs-input:web.recipe.needs-input.measure');
  await expect(page.locator('#pg-inspector-content')).not.toContainText('Analyze daily attendance');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Analytical workspace' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toHaveText('renderer-ready');
  await expect(page.locator('[data-testid="goal-workspace"]')).toHaveAttribute('data-needs', 'summary,trend,breakdown');
  await page.getByRole('button', { name: 'Request anomaly' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toContainText('unsupported:intent.unknown-custom');
  await expect(page.locator('[data-testid="goal-workspace"]')).toContainText('Ada');
  await page.getByRole('button', { name: 'Reset playground' }).click();
  await page.getByRole('button', { name: 'Analytical workspace' }).click();
  await expect(page.locator('[data-testid="goal-status"]')).toHaveText('renderer-ready');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
});

test('theme selection follows the system, updates mounted components, and persists an override', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  const theme = page.getByRole('combobox', { name: 'Theme' });
  const region = page.locator('aeliqo-region[data-aeliqo-theme]');
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(region).toHaveAttribute('data-aeliqo-theme', 'dark');

  await theme.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(region).toHaveAttribute('data-aeliqo-theme', 'light');
  await page.reload();
  await expect(theme).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('aeliqo-region[data-aeliqo-theme]')).toHaveAttribute('data-aeliqo-theme', 'light');

  await theme.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('aeliqo-region[data-aeliqo-theme]')).toHaveAttribute('data-aeliqo-theme', 'dark');
});

test('connected-agent mode never fabricates MCP, WebMCP, or BYOK evidence', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.getByRole('button', { name: 'Check local connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check local connection' }).click();
  await expect(page.locator('#pg-connect-status')).toContainText(/WebMCP|browser/i);
  expect(requests.some((url) => url.includes('/api/aeliqo/session'))).toBe(true);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('simulated WebMCP host registers the standard tools and renders through the current Region', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await page.locator('#pg-connection-kind').selectOption('webmcp');
  await page.getByRole('button', { name: 'Check local connection' }).click();
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
    const detail = await tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'webmcp-person-detail',
      kind: 'detail',
      resource: 'people',
      identity: { id: 'p-1' },
    });
    return { names, context, render, detail };
  });
  expect(result.names).toEqual(['aeliqo_act', 'aeliqo_context', 'aeliqo_render']);
  expect(result.context).toMatchObject({ ok: true, value: { state: 'accepted' } });
  expect(result.render).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  expect(result.detail).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  await expect(page.locator('aeliqo-detail')).toContainText('Ada Chen');
  const trend = await page.evaluate(async () => {
    const tools = (
      globalThis as typeof globalThis & {
        __aeliqoWebMcpTools: Map<string, { execute(input: unknown): Promise<unknown> }>;
      }
    ).__aeliqoWebMcpTools;
    return tools.get('aeliqo_render')?.execute({
      version: '1',
      id: 'people-trend',
      kind: 'analyze',
      resource: 'workforce-headcount',
      measures: [{ id: 'month-end-headcount', revision: '1' }],
      time: { field: 'month', grain: 'month', calendar: 'gregorian', timezone: 'UTC' },
      preferredView: 'trend',
      sort: [{ field: 'month', direction: 'asc' }],
    });
  });
  expect(trend).toMatchObject({ ok: true, value: { state: 'renderer-ready' } });
  await expect(page.locator('aeliqo-chart')).toBeVisible();
  await expect(page.locator('#pg-result-title')).toHaveText('Monthly headcount');
  await expect(page.locator('#pg-result-definition')).toContainText('never summed across months');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
});

test('candidate playground does not offer a ZIP pinned to an unpublished release', async ({ page }) => {
  test.skip(process.env.AELIQO_EXPORT_VERIFIED_VERSION === '0.5.0', 'Stable export is enabled.');
  await page.goto('/playground/');
  await page.locator('#pg-scenario').selectOption('knowledge');
  await expect(page.getByRole('button', { name: 'Export project' })).toBeDisabled();
  await expect(page.locator('#pg-export-note')).toContainText('0.5.0 packages');
  await expect(page.locator('#pg-export-note a')).toHaveAttribute('href', '/examples/');
  await page.locator('#pg-export-note a').click();
  await expect(page.getByRole('heading', { name: 'Run the 0.5 source' })).toBeVisible();
  await expect(page.locator('main')).toContainText('pnpm install --frozen-lockfile');
  await expect(page.locator('main')).toContainText('pnpm test:vnext:browser');
});

test('stable export follows the four base scenarios and never substitutes them for public journeys', async ({
  page,
}) => {
  test.skip(process.env.AELIQO_EXPORT_VERIFIED_VERSION !== '0.5.0', 'Requires verified stable export.');
  await page.goto('/playground/');
  const exportButton = page.getByRole('button', { name: 'Export project' });
  await expect(exportButton).toBeEnabled();
  for (const journey of ['jakarta', 'attendance', 'workspace']) {
    await page.locator(`[data-journey="${journey}"]`).click();
    await expect(exportButton).toBeDisabled();
    await expect(page.locator('#pg-export-note')).toContainText('no matching project ZIP');
    await expect(page.locator('#pg-export-note a')).toHaveAttribute('href', '/examples/');
    await page.locator('#pg-scenario').selectOption('products');
    await expect(exportButton).toBeEnabled();
    await expect(page.locator('#pg-export-note')).toBeHidden();
  }
  for (const scenario of ['people', 'products', 'support', 'knowledge']) {
    await page.locator('#pg-scenario').selectOption(scenario);
    const download = page.waitForEvent('download');
    await exportButton.click();
    expect((await download).suggestedFilename()).toBe(`aeliqo-${scenario}-example.zip`);
  }
});

test('home, deep docs, search, and narrow playground remain navigable', async ({ page }) => {
  const errors: string[] = [];
  const resizeObserverErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.exposeFunction('__aeliqoRecordResizeObserverError', (message: string) => {
    resizeObserverErrors.push(message);
  });
  await page.addInitScript(() => {
    window.addEventListener('error', (event) => {
      if (!event.message.startsWith('ResizeObserver loop')) return;
      void (
        window as unknown as Window & {
          __aeliqoRecordResizeObserverError(message: string): void;
        }
      ).__aeliqoRecordResizeObserverError(event.message);
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#demo-status')).toContainText('4 of 4');
  await page.screenshot({ path: 'artifacts/site-browser/home-desktop.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.locator('#team').selectOption('Engineering');
  await expect(page.locator('#demo-status')).toContainText('2 of 4');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'artifacts/site-browser/home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/concepts/');
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
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(resizeObserverErrors).toEqual([]);
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
  await page.getByRole('button', { name: 'Apply filter', exact: true }).click();
  await expect(page.locator('#demo-status')).toContainText('2 of 4 synthetic people matched');
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
  await page.locator('details').filter({ hasText: 'View the runtime call' }).locator('summary').click();
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
    await expect(page.getByText(/Expected result:/)).toBeVisible();
    await expect(page.locator(`[data-example-code="${id}"]`)).toContainText('registerAeliqoElements');
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
  await expect(page.getByText(/Filtering, structured intents, and evaluation run in the browser/)).toBeVisible();
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
