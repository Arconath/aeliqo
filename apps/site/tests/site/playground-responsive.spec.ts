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
  await expect(page.locator('#pg-status')).toContainText('committed through the public runtime');
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  await page.getByRole('button', { name: 'Engineering only' }).click();
  await expect(page.locator('aeliqo-table')).toContainText('Sam Rivera');
  await expect(page.locator('aeliqo-table')).not.toContainText('Ada Chen');
  await page.getByRole('button', { name: 'Show trend' }).click();
  await expect(page.locator('aeliqo-chart')).toBeVisible();
  await expect(page.locator('aeliqo-chart svg')).toBeAttached();
  await expect(page.locator('#pg-model-calls')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('container adaptation switches browse to cards but preserves comparisons', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto('/playground/');
  await expect(page.locator('#pg-receipt-state')).toHaveText('renderer-ready');
  await expect(page.locator('aeliqo-card-collection')).toBeVisible();
  await expect(page.locator('aeliqo-table')).toHaveCount(0);
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
  await page.goto('/playground/');
  await openScenario(page, 'products');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.locator('aeliqo-form')).toBeVisible();
  await page.getByRole('textbox', { name: 'Product ID' }).fill('pr-5');
  await page.getByRole('textbox', { name: 'Name' }).fill('Travel ruler');
  await page.getByRole('textbox', { name: 'Category' }).fill('Stationery');
  await page.getByRole('textbox', { name: 'Price' }).fill('6.5');
  await page.getByRole('textbox', { name: 'Stock' }).fill('24');
  await page.getByRole('button', { name: 'Create Products' }).click();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeVisible();
  await expect(page.locator('#pg-action-content')).toContainText('products.create');
  await expect(page.locator('#pg-action-content')).toContainText('Travel ruler');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Travel ruler');
  await page.getByRole('button', { name: 'Create Products' }).click();
  const confirm = page.getByRole('button', { name: 'Confirm action' });
  await confirm.dblclick();
  await expect(page.getByRole('dialog', { name: 'Review action' })).toBeHidden();
  await expect(page.locator('#pg-status')).toHaveText('Action completed.');
  await expect(page.locator('#pg-receipt-state')).toHaveText('executed');
  await expect(page.getByRole('button', { name: 'Create Products' })).toBeFocused();
});

test('edit form loads trusted current state and keeps the draft after cancellation', async ({ page }) => {
  await page.goto('/playground/');
  await openScenario(page, 'support');
  await page.getByRole('button', { name: 'Edit ticket' }).click();
  await expect(page.locator('aeliqo-form')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue('Invoice PDF is unavailable');
  await expect(page.getByRole('textbox', { name: 'Ticket ID' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Status' }).fill('Pending');
  await page.getByRole('button', { name: 'Save Support tickets' }).click();
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
  await page.getByRole('button', { name: 'Connected agent' }).click();
  await expect(page.getByRole('textbox', { name: 'Local BYOK prompt' })).toBeDisabled();
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.locator('#pg-connect-status')).not.toContainText('Checking capability');
  await expect(page.getByRole('textbox', { name: 'Local BYOK prompt' })).toBeDisabled();
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
