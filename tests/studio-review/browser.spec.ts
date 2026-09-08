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

  test('renders a real local evaluation and edits an Experience revision', async ({page}) => {
    await page.goto('/');
    await expect(page.getByLabel('Local evaluation result')).toContainText('79');

    await page.getByRole('button', {name: 'Experience'}).click();
    await page.getByLabel('Label').fill('Edited employee inspection');
    await page.getByLabel('Revision').fill('2');
    await page.getByLabel('Mode').selectOption('fixed');
    await page.getByRole('button', {name: 'Save profile revision'}).click();
    await expect(page.locator('#profile-select')).toHaveValue('employee-inspection@2');
    await expect(page.locator('#profile-select')).toContainText('Edited employee inspection');
    await expect(page.locator('.section-heading .badge')).toHaveText('fixed');
  });

  test('defers visible rerender until an IME composition ends', async ({page}) => {
    await page.goto('/');
    const meaningId = page.getByLabel('Meaning ID');
    await meaningId.fill('employees.imeDraft');
    await meaningId.focus();
    await meaningId.dispatchEvent('compositionstart');
    await page.locator('#import-file').setInputFiles({name: 'ime-malformed.json', mimeType: 'application/json', buffer: Buffer.from('{ malformed')});
    await page.waitForTimeout(100);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await meaningId.dispatchEvent('compositionend');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Meaning ID')).toHaveValue('employees.imeDraft');
    await expect(page.getByLabel('Meaning ID')).toBeFocused();
  });
});
