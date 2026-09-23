import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openScenario(page: Page, scenario: 'people' | 'products' | 'support' | 'knowledge'): Promise<void> {
  await page.locator('#pg-scenario').selectOption(scenario);
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
}

test('guided intents render real adaptive views without a model', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/playground/');

  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-table')).toBeVisible();
  await expect(page.locator('#pg-status')).toContainText('is ready');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.getByRole('button', { name: 'Engineering only' }).click();
  await expect(page.locator('aeliqo-table')).toContainText('Sam Rivera');
  await expect(page.locator('aeliqo-table')).not.toContainText('Ada Chen');
  await page.getByRole('button', { name: 'Browse people' }).click();
  await expect(page.locator('aeliqo-table')).toContainText('Ada Chen');
  await page.getByRole('button', { name: 'Monthly headcount' }).click();
  await expect(page.locator('#pg-result-definition')).toContainText('employees active at the end of each month');
  await expect(page.locator('#pg-result-definition')).toContainText('never summed across months');
  await expect(page.locator('aeliqo-chart')).toBeVisible();
  await expect(page.locator('aeliqo-chart svg')).toBeAttached();
  await expect(page.locator('aeliqo-chart svg text.axis-x-tick')).toHaveCount(3);
  await expect(page.locator('aeliqo-chart svg text.axis-y-tick')).toHaveCount(3);
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('a constant series keeps its mark on the labeled y-axis tick', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  const positions = await page.evaluate(async () => {
    const chart = document.createElement('aeliqo-chart') as HTMLElement & {
      points: readonly { label: string; value: number }[];
      title: string;
      updateComplete: Promise<unknown>;
    };
    chart.title = 'Stable count';
    chart.points = [
      { label: 'First', value: 7 },
      { label: 'Second', value: 7 },
    ];
    document.body.append(chart);
    await chart.updateComplete;
    const svg = chart.shadowRoot?.querySelector('svg');
    const tick = svg?.querySelector('text.axis-y-tick')?.getAttribute('y');
    const point = svg?.querySelector('circle[part="point"]')?.getAttribute('cy');
    return { tickY: Number(tick) - 3, pointY: Number(point) };
  });

  expect(positions.tickY).toBeCloseTo(positions.pointY, 4);
});

test('trend axis labels stay inside the chart on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Monthly headcount' }).click();

  const svg = page.locator('aeliqo-chart svg');
  await expect(svg).toBeVisible();
  await expect(svg.locator('text.axis-x-tick')).toHaveCount(3);
  await expect(svg.locator('text.axis-y-tick')).toHaveCount(3);
  const ticksOverflow = await svg.locator('text.axis-x-tick, text.axis-y-tick').evaluateAll((ticks) =>
    ticks.some((tick) => {
      if (!(tick instanceof SVGGraphicsElement)) return true;
      const bounds = tick.getBBox();
      const viewBox = tick.ownerSVGElement?.viewBox.baseVal;
      return (
        viewBox === undefined ||
        bounds.x < 0 ||
        bounds.y < 0 ||
        bounds.x + bounds.width > viewBox.width ||
        bounds.y + bounds.height > viewBox.height
      );
    }),
  );
  expect(ticksOverflow).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('trend geometry follows its container without stretching labels', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Monthly headcount' }).click();
  const svg = page.locator('aeliqo-chart svg');
  await expect(svg).toBeVisible();

  const narrow = await svg.evaluate((node) => {
    const chart = node as SVGSVGElement;
    const box = chart.getBoundingClientRect();
    const matrix = chart.getScreenCTM();
    return { clientWidth: box.width, logicalWidth: chart.viewBox.baseVal.width, xScale: matrix?.a, yScale: matrix?.d };
  });
  expect(Math.abs(narrow.logicalWidth - narrow.clientWidth)).toBeLessThan(4);
  expect(Math.abs((narrow.xScale ?? 0) - (narrow.yScale ?? 0))).toBeLessThan(0.02);

  await page.setViewportSize({ width: 1_280, height: 850 });
  await expect
    .poll(async () => svg.evaluate((node) => (node as SVGSVGElement).viewBox.baseVal.width))
    .toBeGreaterThan(narrow.logicalWidth + 400);
  const wideScale = await svg.evaluate((node) => {
    const matrix = (node as SVGSVGElement).getScreenCTM();
    return { x: matrix?.a, y: matrix?.d };
  });
  expect(Math.abs((wideScale.x ?? 0) - (wideScale.y ?? 0))).toBeLessThan(0.02);
});

test('container adaptation switches browse to cards but preserves comparisons', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-card-collection')).toBeVisible();
  await expect(page.locator('aeliqo-table')).toHaveCount(0);
  await expect(page.locator('#pg-view-badge')).toHaveText('data.card-collection');
  await expect(page.locator('#pg-status')).toContainText('is ready');
  await openScenario(page, 'products');
  await expect(page.locator('aeliqo-card-collection')).toContainText('Field notebook');
  await page.getByRole('button', { name: 'Compare products' }).click();
  await expect(page.locator('aeliqo-table')).toBeVisible();
  await expect(page.locator('aeliqo-table')).toContainText('Desk lamp');
  await expect(page.locator('aeliqo-table')).toContainText('Laptop stand');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('schema-derived create form requires explicit confirmation before writing', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/playground/');
  await openScenario(page, 'products');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.locator('aeliqo-form')).toBeVisible();
  await page.getByRole('textbox', { name: 'Product ID' }).fill('pr-5');
  await page.getByRole('textbox', { name: 'Name' }).fill('Travel ruler');
  await page.getByRole('textbox', { name: 'Category' }).fill('Stationery');
  await page.getByRole('textbox', { name: 'Price' }).fill('6.5');
  await page.getByRole('textbox', { name: 'Stock' }).fill('24');
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeVisible();
  await expect(page.locator('#pg-action-content')).toContainText('products.create');
  await expect(page.locator('#pg-action-content')).toContainText('Travel ruler');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Travel ruler');
  await page.getByRole('button', { name: 'Create record' }).click();
  const confirm = page.getByRole('button', { name: 'Confirm action' });
  await confirm.dblclick();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeVisible();
  await expect(page.locator('#pg-status')).toHaveText('Action completed.');
  await expect(page.locator('#pg-receipt-state')).toHaveText('executed');
  await expect(confirm).toBeDisabled();
  await page.getByRole('button', { name: 'Done' }).dblclick();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeHidden();
  await expect(page.locator('#pg-status')).toHaveText('Action completed.');
  await expect(page.getByRole('button', { name: 'Create record' })).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test('edit form loads trusted current state and keeps the draft after cancellation', async ({ page }) => {
  await page.goto('/playground/');
  await openScenario(page, 'support');
  await page.getByRole('button', { name: 'Edit ticket' }).click();
  await expect(page.locator('aeliqo-form')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue('Invoice PDF is unavailable');
  await expect(page.getByRole('textbox', { name: 'Ticket ID' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Status' }).fill('Pending');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Status' })).toHaveValue('Pending');
});

test('consumer-defined intent and view work without modifying core', async ({ page }) => {
  await page.goto('/playground/');
  await openScenario(page, 'knowledge');
  await page.getByRole('button', { name: 'Read article' }).click();
  await expect(page.locator('.knowledge-article')).toContainText('Rotate an API token safely');
  await page.getByRole('button', { name: 'Security topic' }).click();
  await expect(page.locator('aeliqo-card-collection')).toContainText('Rotate an API token safely');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
});

test('inspector exposes bounded evidence, not records or private runtime payloads', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  await expect(page.locator('#pg-inspector-content')).toContainText('catalogRevision');
  await page.getByRole('button', { name: 'Result', exact: true }).click();
  await expect(page.locator('#pg-inspector-content')).toContainText('"loaded": 4');
  await expect(page.locator('#pg-inspector-content')).not.toContainText('Ada Chen');
  await expect(page.locator('#pg-inspector-content')).not.toContainText('"rows"');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused();
});

test('mobile controls, disconnected agent state, and accessibility remain honest and usable', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/playground/');
  await page.getByRole('button', { name: 'Connect AI' }).click();
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
  await page.getByRole('button', { name: 'Check local connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.getByRole('textbox', { name: 'Prompt' })).toBeDisabled();
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Inspector' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('.pg-app').analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Inspector' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Inspect', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests.some((url) => url.includes('/api/aeliqo/session'))).toBe(true);
  expect(requests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});
