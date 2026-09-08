import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({page}) => { await page.goto('/tests/visualization/index.html'); await page.locator('aeliqo-tree table').waitFor(); });

test('tree keeps bounded SVG and exact table selection', async ({page}) => {
  await expect(page.locator('aeliqo-tree svg')).toHaveCount(1);
  await expect(page.getByRole('cell', {name: 'Child A', exact: true})).toBeVisible();
  expect((await new AxeBuilder({page}).include('aeliqo-tree').analyze()).violations).toEqual([]);
  await page.locator('aeliqo-tree table button').nth(1).focus();
  await page.keyboard.press('Enter');
  const selection = await page.evaluate(() => (window as typeof window & {selection?: {source: string; identity: string; result: {scopeDigest: string}}}).selection);
  expect(selection?.source).toBe('user'); expect(selection?.result.scopeDigest).toBe('scope'); expect(selection?.identity).toContain('child-a');
  await expect(page.locator('aeliqo-tree [part=node][aria-label="Child A"]')).toHaveAttribute('aria-pressed', 'true');
});

test('geometry budget preserves exact data alternative', async ({page}) => {
  await page.evaluate(async () => { const tree = (window as typeof window & {tree: {maxMarks: number; updateComplete: Promise<unknown>}}).tree; tree.maxMarks = 1; await tree.updateComplete; });
  await expect(page.locator('aeliqo-tree svg')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('mark budget');
  await expect(page.locator('aeliqo-tree tbody tr')).toHaveCount(3);
  await page.locator('aeliqo-tree table button').first().focus(); await page.keyboard.press('Enter');
  const selection = await page.evaluate(() => (window as typeof window & {selection?: {source: string}}).selection);
  expect(selection?.source).toBe('user');
});
