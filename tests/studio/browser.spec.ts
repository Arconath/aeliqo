import {expect, test} from '@playwright/test';

test.describe('local Studio', () => {
  test('moves through all four spaces and exports a reviewed document', async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Data & Meaning'})).toBeVisible();
    await expect(page.getByText('read-only', {exact: true})).toBeVisible();

    await page.getByRole('button', {name: 'Experience'}).click();
    await expect(page.getByRole('heading', {name: 'Experience'})).toBeVisible();
    await page.getByRole('button', {name: 'Dark'}).click();
    await page.getByRole('button', {name: 'stale'}).click();
    await expect(page.locator('.matrix-label span').first()).toHaveText('stale');

    await page.getByRole('button', {name: 'Component Gallery'}).click();
    await expect(page.getByRole('heading', {name: 'Component Gallery'})).toBeVisible();
    await expect(page.locator('aeliqo-metric')).toBeVisible();
    await expect(page.locator('aeliqo-table')).toBeVisible();

    await page.getByRole('button', {name: 'Data & Meaning'}).click();
    await page.getByLabel('Meaning ID').fill('employees.localAverage');
    await page.getByLabel('Label').fill('Local average');
    await page.getByRole('button', {name: 'Create local draft'}).click();
    await expect(page.getByText('Local average', {exact: true})).toBeVisible();

    await page.getByRole('button', {name: 'Inspect'}).click();
    await expect(page.getByText('studio draft', {exact: true})).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export document'}).click();
    expect((await download).suggestedFilename()).toBe('studio-demo.aeliqo.json');
    expect(errors).toEqual([]);
  });
});
