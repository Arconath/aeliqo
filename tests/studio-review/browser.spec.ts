import {expect, test} from '@playwright/test';

test.describe('T26 Studio browser boundary review', () => {
  test('shows malformed import diagnostics in the visible workspace', async ({page}) => {
    await page.goto('/');
    await page.locator('#import-file').setInputFiles({name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from('{ malformed')});
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/json|document|invalid/i);
  });

  test('preserves a partially authored meaning while navigating between spaces', async ({page}) => {
    await page.goto('/');
    const meaningId = page.getByLabel('Meaning ID');
    await meaningId.fill('employees.partialDraft');
    await page.getByRole('button', {name: 'Experience'}).click();
    await expect(page.getByRole('heading', {name: 'Experience'})).toBeVisible();
    await page.getByRole('button', {name: 'Data & Meaning'}).click();
    await expect(page.getByLabel('Meaning ID')).toHaveValue('employees.partialDraft');
    await expect(page.getByLabel('Meaning ID')).toBeFocused();
  });
});
