import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { componentCatalog } from '../shared/catalog.js';

const COMPONENT_ROUTES = componentCatalog.map(({ id }) => `/components/${id}/`);

const ADOPTION_ROUTES = [
  '/start/',
  '/start/existing-app/',
  '/start/frameworks/',
  '/guides/resources/',
  '/agents/',
  '/concepts/',
  '/components/',
  '/reference/',
  '/ship/',
  '/examples/',
] as const;

test('documentation information architecture exposes distinct adoption routes', async ({ page }) => {
  for (const route of ['/docs/', ...ADOPTION_ROUTES]) {
    await page.goto(route);
    await expect(page.locator('.reading h1')).toBeVisible();
    await expect(page.locator('.docs-sidebar')).toBeVisible();
  }

  await page.goto('/docs/');
  for (const route of ADOPTION_ROUTES)
    await expect(page.locator(`.docs-sidebar a[href="${route}"]`).first()).toBeVisible();
  for (const route of ['/start/', '/start/existing-app/', '/start/what-is-aeliqo/', '/playground/']) {
    await expect(page.locator(`.reading a[href="${route}"]`).first()).toBeVisible();
  }
});

test('documentation search keeps keyboard, query, no-result, and fallback paths', async ({ browser, page }) => {
  await page.goto('/concepts/');
  await expect(page.locator('.docs-search-tools .docs-search-fallback')).toBeHidden();
  await expect(page.locator('.search-trigger')).toBeVisible();
  await page.keyboard.press('Control+K');
  const searchDialog = page.locator('#docs-search-dialog');
  await expect(searchDialog.getByRole('dialog')).toBeVisible();
  const field = page.locator('#docs-search-dialog input.docs-search-field');
  await field.fill('table');
  const rankedLinks = page.locator('#docs-search-dialog .search-results a');
  await expect(rankedLinks.first()).toHaveAttribute('href', '/components/data.table/');
  await expect(rankedLinks.first().locator('strong')).toHaveText('Table');
  await expect(page.locator("#docs-search-dialog .search-results a[href='/components/navigation.tabs/']")).toHaveCount(
    0,
  );
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['landmark-no-duplicate-banner', 'landmark-unique', 'region'].includes(violation.id),
    ),
  ).toEqual([]);
  await field.fill('meaning');
  await expect(page).toHaveURL(/\?q=meaning$/);
  await expect(page.locator('#docs-search-dialog').getByRole('link').first()).toBeVisible();
  await field.fill('no-such-aeliqo-page');
  await expect(page.locator('#docs-search-dialog')).toContainText('No pages found');

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto('/search/?q=meaning');
    await expect(noScriptPage.getByRole('heading', { level: 1, name: 'Search documentation' })).toBeVisible();
    await expect(noScriptPage.locator('form.docs-search-fallback').first()).toHaveAttribute('action', '/search/');
    await expect(noScriptPage.locator('.search-fallback-links a').first()).toBeVisible();
    await noScriptPage.goto('/components/data.table/');
    await expect(noScriptPage.locator('.docs-search-tools .docs-search-fallback')).toBeVisible();
    await expect(noScriptPage.locator('.search-trigger')).toBeHidden();
  } finally {
    await noScriptContext.close();
  }
});

test('component pages combine authored guidance with generated API facts and the executable example', async ({
  page,
}) => {
  await page.goto('/components/data.table/');
  for (const heading of [
    'Import and live example',
    'Purpose',
    'When to use it',
    'When to use a different component',
    'Properties and defaults',
    'Events',
    'States and failure handling',
    'Keyboard, focus, and accessibility',
    'Responsive behavior',
    'Style hooks',
    'Performance limits',
    'Related components',
    'Generated TypeScript declaration',
    'Version',
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  const preview = await page.locator('[data-preview-mount]').boundingBox();
  const purpose = await page.getByRole('heading', { name: 'Purpose', exact: true }).boundingBox();
  expect(preview).not.toBeNull();
  expect(purpose).not.toBeNull();
  expect(preview!.y).toBeLessThan(purpose!.y);
  await expect(page.getByText(/Expected result:/)).toBeVisible();
  await expect(page.locator('.component-adoption')).not.toContainText('{{aeliqo:');
  await expect(page.locator('[data-example-code=table]')).toContainText('import');
  await page.locator('.component-declaration summary').click();
  await expect(page.locator('.component-declaration')).toContainText('AeliqoTableElement');
  await expect(page.locator('.reading')).not.toContainText('not declared');

  await page.goto('/components/compound.form-flow/');
  await expect(page.getByRole('heading', { name: 'Performance limits', exact: true })).toHaveCount(0);
  await page.goto('/components/compound.comparison/');
  await expect(page.getByRole('heading', { name: 'Performance limits', exact: true })).toBeVisible();
  await expect(page.locator('.reading')).toContainText('MAX_COMPARISON_KEYS');
});

test('all 71 component previews load without page or console errors', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  for (const route of COMPONENT_ROUTES) {
    await page.goto(route);
    await expect(page.locator('[data-preview-status]'), route).toHaveText('Interactive preview loaded.');
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('dialog preview can close and reopen from its documented trigger', async ({ page }) => {
  await page.goto('/components/feedback.dialog/');
  await expect(page.locator('[data-preview-status]')).toHaveText('Interactive preview loaded.');
  const trigger = page.getByRole('button', { name: 'Open confirmation' });
  const dialog = page.getByRole('dialog', { name: 'Confirm archive' });
  await expect(dialog).toBeHidden();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Archive report' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('narrow documentation exposes compact navigation before the requested article', async ({ browser, page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/components/data.table/');
  const heading = await page.getByRole('heading', { level: 1, name: 'Table', exact: true }).boundingBox();
  const sidebar = await page.locator('.docs-sidebar').boundingBox();
  expect(heading).not.toBeNull();
  expect(sidebar).not.toBeNull();
  expect(heading!.y).toBeLessThan(800);
  expect(sidebar!.y).toBeLessThan(heading!.y);
  await expect(page.locator('.docs-nav-toggle')).not.toBeChecked();
  await page.locator('label.docs-nav-summary').click();
  await expect(page.locator('.docs-nav-toggle')).toBeChecked();
  await expect(page.locator('.docs-sidebar nav')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto('/components/data.table/');
    const noScriptHeading = await noScriptPage
      .getByRole('heading', { level: 1, name: 'Table', exact: true })
      .boundingBox();
    const noScriptSidebar = await noScriptPage.locator('.docs-sidebar').boundingBox();
    expect(noScriptHeading).not.toBeNull();
    expect(noScriptSidebar).not.toBeNull();
    expect(noScriptHeading!.y).toBeLessThan(800);
    expect(noScriptSidebar!.y).toBeLessThan(noScriptHeading!.y);
    await expect(noScriptPage.locator('.docs-nav-toggle')).not.toBeChecked();
    expect(await noScriptPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await noScriptContext.close();
  }
});

test('all generated component routes fit 320px and 360px without page overflow', async ({ browser }) => {
  test.setTimeout(180_000);
  for (const width of [320, 360]) {
    const hydratedContext = await browser.newContext({ viewport: { width, height: 800 } });
    const hydratedPage = await hydratedContext.newPage();
    try {
      for (const route of COMPONENT_ROUTES) {
        await hydratedPage.goto(route);
        await expect(hydratedPage.locator('.reading h1')).toBeVisible();
        await expect
          .poll(() => hydratedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
            message: `component route must fit ${width}px: ${route}`,
          })
          .toBe(true);
      }
    } finally {
      await hydratedContext.close();
    }

    const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 800 } });
    const noScriptPage = await noScriptContext.newPage();
    try {
      for (const route of COMPONENT_ROUTES) {
        await noScriptPage.goto(route);
        await expect(noScriptPage.locator('.reading h1')).toBeVisible();
        expect(await noScriptPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      await noScriptContext.close();
    }
  }
});

test('scrollable code remains focusable and named across static, hydrated, and opened states', async ({
  browser,
  page,
}) => {
  await page.goto('/start/');
  const packageManifest = page.locator('.reading .doc-code pre').first();
  await expect(packageManifest).toContainText('"@aeliqo/react": "0.5.0"');
  await expect(packageManifest).toHaveAttribute('tabindex', '0');
  await packageManifest.focus();
  await expect(packageManifest).toBeFocused();
  const typescriptConfig = page.locator('.reading .doc-code pre').nth(1);
  await expect(typescriptConfig).toContainText('"moduleResolution": "Bundler"');
  await expect(typescriptConfig).toHaveAttribute('tabindex', '0');
  await typescriptConfig.focus();
  await expect(typescriptConfig).toBeFocused();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto('/start/');
    const staticPackageManifest = noScriptPage.locator('.reading .doc-code pre').first();
    await expect(staticPackageManifest).toContainText('"@aeliqo/react": "0.5.0"');
    await expect(staticPackageManifest).toHaveAttribute('tabindex', '0');
    await staticPackageManifest.focus();
    await expect(staticPackageManifest).toBeFocused();

    await noScriptPage.goto('/components/data.table/');
    const noScriptDetails = noScriptPage.locator('details.component-example');
    await noScriptDetails.evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
    const noScriptExample = noScriptDetails.locator('pre');
    await expect(noScriptExample).toHaveAttribute('tabindex', '0');
    await noScriptExample.focus();
    await expect(noScriptExample).toBeFocused();
  } finally {
    await noScriptContext.close();
  }

  await page.goto('/components/data.table/');
  const details = page.locator('details.component-example');
  await details.locator('summary').click();
  const example = details.locator('pre');
  await expect(example).toHaveAttribute('tabindex', '0');
  await example.focus();
  await expect(example).toBeFocused();
  const apiPre = page.locator('.code-scroll > pre');
  await expect(apiPre).toHaveAttribute('tabindex', '0');
  await expect(apiPre).not.toHaveAttribute('aria-label');
  await expect(page.locator('.code-scroll')).toHaveAttribute('role', 'region');
  await expect(page.locator('.code-scroll')).toHaveAttribute('aria-label', 'Table TypeScript declaration');
  const openedA11y = await new AxeBuilder({ page }).include('main').analyze();
  expect(openedA11y.violations).toEqual([]);
});

test('every generated component example keeps its code focusable when opened', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of COMPONENT_ROUTES) {
    try {
      await page.goto(route);
    } catch (error) {
      // Chromium can abort one navigation while rapidly replacing 71 documents.
      // Retry only that transport-level abort; all HTTP and assertion failures remain fatal.
      if (!(error instanceof Error) || !error.message.includes('net::ERR_ABORTED')) throw error;
      await page.goto(route);
    }
    const details = page.locator('details.component-example');
    await details.evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
    const pre = details.locator('pre');
    await expect(pre).toHaveAttribute('tabindex', '0');
  }
});

test('homepage code disclosures remain focusable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const details = page.locator('details.demo-source');
  await details.locator('summary').click();
  const pre = details.locator('pre');
  await expect(pre).toHaveAttribute('tabindex', '0');
  await pre.focus();
  await expect(pre).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('homepage adaptive result remains a named accessible section after evaluation', async ({ page }) => {
  await page.goto('/');
  await page.locator('#team').selectOption('Engineering');
  await page.getByRole('button', { name: 'Apply filter', exact: true }).click();
  const result = page.getByRole('region', { name: 'Synthetic people adaptive result', exact: true });
  await expect(result).toBeVisible();
  await expect(result).toContainText('Sam Rivera');
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('enabled analytics consent is announced in flow before documentation', async ({ page }) => {
  await page.goto('/docs/');
  const consent = page.locator('#analytics-consent');
  const prepared = await page.evaluate(async () => {
    const analyticsModule = '/src/analytics.ts';
    const { prepareGoogleAnalytics } = await import(analyticsModule);
    const values = new Map<string, string>();
    const browser = {
      location: { hostname: 'aeliqo.com', protocol: 'https:', origin: 'https://aeliqo.com', pathname: '/docs/' },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: () => true,
    } as unknown as Window;
    return prepareGoogleAnalytics({ enabled: true, measurementId: 'G-ABCDEF' }, browser, document);
  });
  expect(prepared).toBe(true);
  await expect(consent).toHaveAttribute('role', 'region');
  await expect(consent).toHaveAttribute('aria-live', 'polite');
  await expect(consent).toBeVisible();
  await expect(consent.getByRole('button', { name: 'Allow analytics', exact: true })).toBeVisible();
  const consentBox = await consent.boundingBox();
  const headingBox = await page
    .getByRole('heading', { level: 1, name: 'Build your first adaptive interface', exact: true })
    .boundingBox();
  expect(consentBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(consentBox!.y).toBeLessThan(page.viewportSize()!.height);
  expect(consentBox!.y).toBeLessThan(headingBox!.y);
  const accessibility = await new AxeBuilder({ page }).include('#analytics-consent').analyze();
  expect(accessibility.violations).toEqual([]);
});
