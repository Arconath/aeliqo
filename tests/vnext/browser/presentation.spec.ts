import { expect, test } from '@playwright/test';

async function setRegionWidth(page: import('@playwright/test').Page, width: number): Promise<void> {
  await page.locator('#people-host').evaluate((element, value) => {
    (element as HTMLElement).style.width = `${value}px`;
  }, width);
}

test.describe('public app presentation paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#page-status')).toHaveText('Ready');
  });

  test('renders the registered table and cards browse views', async ({ page }) => {
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.table');
    await expect(page.locator('#people-host aeliqo-table')).toHaveCount(1);
    await expect(page.getByText('Ada Chen')).toBeVisible();

    await page.getByRole('button', { name: 'Cards' }).click();
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.card-collection');
    await expect(page.locator('#people-host aeliqo-card-collection')).toHaveCount(1);
  });

  test('renders the registered bar analysis view', async ({ page }) => {
    await page.getByRole('button', { name: 'Bar' }).click();
    await expect(page.locator('#analysis-status')).toContainText('renderer-ready:visualization.bar');
    await expect(page.locator('#analysis-host aeliqo-bar')).toHaveCount(1);
  });

  test('renders a bounded comparison split with two table children', async ({ page }) => {
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.locator('#compare-status')).toContainText('renderer-ready:foundation.split-pane');
    await expect(page.locator('#compare-host aeliqo-split-pane')).toHaveCount(1);
    await expect(page.locator('#compare-host aeliqo-table')).toHaveCount(2);
  });

  test('preserves the last valid table when a later request is unsupported', async ({ page }) => {
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('#people-host aeliqo-table')).toHaveCount(1);
    await page.getByRole('button', { name: 'Unsupported request' }).click();
    await expect(page.locator('#people-status')).toContainText('failed:');
    await expect(page.locator('#people-host aeliqo-table')).toHaveCount(1);
    await expect(page.getByText('Ada Chen')).toBeVisible();
  });

  test('keeps a focused dirty draft through a guarded resize and adapts after blur', async ({ page }) => {
    await page.getByRole('button', { name: 'Table' }).click();
    const draft = page.getByLabel('Draft note');
    await draft.fill('keep this draft');
    await draft.focus();

    await setRegionWidth(page, 620);
    await expect(draft).toBeFocused();
    await expect(draft).toHaveValue('keep this draft');

    await page.getByRole('heading', { name: 'People browse' }).click();
    await page.getByRole('button', { name: 'Cards' }).click();
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.card-collection');
    await expect(draft).toHaveValue('keep this draft');
  });

  test('keeps selection and applies resize hysteresis around the breakpoint', async ({ page }) => {
    await page.getByRole('button', { name: 'Compare' }).click();
    const selection = page.locator('#compare-host aeliqo-table').first().locator('input[type="radio"]');
    await expect(selection).toHaveCount(1);
    await selection.check();
    await expect(selection).toBeChecked();

    await page.getByRole('button', { name: 'Table' }).click();
    await setRegionWidth(page, 620);
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.card-collection');
    await setRegionWidth(page, 640);
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.card-collection');
    await setRegionWidth(page, 700);
    await expect(page.locator('#people-status')).toContainText('renderer-ready:data.table');
  });
});
