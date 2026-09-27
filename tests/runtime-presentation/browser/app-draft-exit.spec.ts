import { expect, test, type Page } from '@playwright/test';

type Snapshot = {
  guardCalls: number;
  saves: number;
  queryCalls: number;
  savedName: string;
  drafts: readonly { field: string; value: unknown }[];
};
const snapshot = (page: Page) =>
  page.evaluate(() => (window as typeof window & { draftFixture: { snapshot(): Snapshot } }).draftFixture.snapshot());
async function edit(page: Page, value = 'Edited Ada') {
  await page.goto('/tests/runtime-presentation/browser/app-draft-exit.html');
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(value);
  await page.getByRole('button', { name: 'Browse', exact: true }).focus();
  await expect.poll(async () => (await snapshot(page)).drafts.length).toBe(1);
}

test('successful form action clears saved drafts before the next render', async ({ page }) => {
  await edit(page);
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(page.locator('#action-status')).toHaveText('executed');
  expect((await snapshot(page)).savedName).toBe('Edited Ada');
  await expect.poll(async () => (await snapshot(page)).drafts.length).toBe(0);
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('renderer-ready');
  expect((await snapshot(page)).guardCalls).toBe(0);
  await expect(page.locator('aeliqo-table')).toContainText('Ada');
});

test('Stay and failed Save retain the blurred draft without evaluating the target', async ({ page }) => {
  await edit(page);
  for (const [choice, status] of [
    ['stay', 'needs-input'],
    ['failed-save', 'failed'],
  ]) {
    await page.locator('#choice').selectOption(choice!);
    await page.getByRole('button', { name: 'Browse', exact: true }).click();
    await expect(page.locator('#status')).toHaveText(status!);
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Edited Ada');
    expect((await snapshot(page)).queryCalls).toBe(0);
    expect((await snapshot(page)).drafts).toHaveLength(1);
  }
});

for (const choice of ['save', 'discard']) {
  test(`${choice} retains the draft on failed target and clears it after a successful transition`, async ({ page }) => {
    await edit(page);
    await page.locator('#choice').selectOption(choice);
    await page.getByRole('button', { name: 'Invalid target' }).click();
    await expect(page.locator('#status')).not.toHaveText('renderer-ready');
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Edited Ada');
    expect((await snapshot(page)).drafts).toHaveLength(1);
    await page.getByRole('button', { name: 'Browse', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('renderer-ready');
    await expect(page.locator('aeliqo-table')).toContainText('Ada');
    expect((await snapshot(page)).drafts).toHaveLength(0);
    expect((await snapshot(page)).saves).toBe(choice === 'save' ? 2 : 0);
  });
}

test('a successful action preserves edits made after its input was captured', async ({ page }) => {
  await edit(page, 'First edit');
  await page.locator('#action-mode').selectOption('held');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(page.locator('#action-status')).toHaveText('dispatching');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('New edit');
  await page.getByRole('button', { name: 'Release action' }).click();
  await expect(page.locator('#action-status')).toHaveText('executed');
  expect((await snapshot(page)).savedName).toBe('First edit');
  expect((await snapshot(page)).drafts).toEqual([expect.objectContaining({ field: 'name', value: 'New edit' })]);
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('needs-input');
});

test('failed form action retains the edited draft', async ({ page }) => {
  await edit(page);
  await page.locator('#action-mode').selectOption('failed');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(page.locator('#action-status')).toHaveText('failed');
  expect((await snapshot(page)).drafts).toHaveLength(1);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Edited Ada');
});
