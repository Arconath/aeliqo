import { expect, test } from '@playwright/test';

test('documentation is searchable and keeps live partial-state examples readable across widths', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.getByRole('article', { name: 'Start here' })).toBeVisible();
  await page.getByRole('searchbox').fill('money');
  await page.getByRole('link', { name: /Data that keeps/ }).click();
  await expect(page.getByText('89.2%', { exact: true })).toBeVisible();
  await expect(page.getByText('Loaded page only; results are not global.', { exact: true })).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.docs-article')).toBeVisible();
    const overflow = await page.locator('.docs-shell').evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow, `documentation shell overflow at ${width}px`).toBe(false);
    await page.screenshot({ path: `artifacts/docs-${width}.png`, fullPage: true });
  }
});

test('public routes present the framework and keep Proof Lab out of the primary experience', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Smart components/ })).toBeVisible();
  await expect(page.getByText('npm install @aeliqo/core @aeliqo/react', { exact: true })).toBeVisible();
  await expect(page.getByText('Protocol control', { exact: true })).toHaveCount(0);
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/home-1280.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/home-390.png', fullPage: true });
  await page.getByRole('link', { name: 'Playground', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI landscape' })).toBeVisible();
  await page.goto('/playground/proof-lab/');
  await expect(page.getByRole('heading', { name: 'Proof Lab' })).toBeVisible();
  await page.goto('/changelog/');
  await expect(page.getByRole('heading', { name: 'Release history' })).toBeVisible();
});

test('timeline range and event selection are keyboard operable', async ({ page }) => {
  await page.goto('/docs/');
  await page.getByRole('link', { name: 'Component reference' }).click();
  const timeline = page.getByRole('region', { name: 'Smart EventTimeline example' });
  const start = timeline.getByLabel('Start');
  const initial = await start.inputValue();
  await start.focus();
  await expect(start).toBeFocused();
  await start.selectOption({ index: 1 });
  expect(await start.inputValue()).not.toBe(initial);
  const event = timeline.getByRole('button', { name: 'Search index refresh' });
  await event.focus();
  await page.keyboard.press('Enter');
  await expect(event).toHaveAttribute('aria-pressed', 'true');
});

test('the public operational Workspace links a group to records and record detail without an agent', async ({ page }) => {
  await page.goto('/docs/#docs-workspace');
  const example = page.getByRole('region', { name: 'Operational Workspace without an agent example' });
  await example.getByRole('button', { name: /Payments/ }).first().click();
  await expect(example.getByRole('button', { name: 'Search index refresh' })).toHaveCount(0);
  const event = example.getByRole('button', { name: 'Payments deploy' });
  await event.click();
  await expect(event).toHaveAttribute('aria-pressed', 'true');
  await expect(example.getByRole('heading', { name: 'Payments deploy' })).toBeVisible();
});
