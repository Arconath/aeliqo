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

  test('binds evaluated data to real preview components at each declared width', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button', {name: 'Experience'}).click();
    for (const width of [320, 360, 768, 1280]) {
      const frame = page.locator(`[data-preview-frame="${width}"]`);
      expect(await frame.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(width);
      await expect(frame.locator('aeliqo-metric')).toContainText('79');
    }
    await expect(page.locator('[data-preview-metric="320"]')).not.toContainText('42');

    await page.getByRole('button', {name: 'loading'}).click();
    await expect(page.locator('[data-preview-metric="320"]')).toContainText('Loading');
    await expect(page.locator('[data-preview-metric="320"]')).not.toContainText('79');
    await page.getByRole('button', {name: 'stale'}).click();
    await expect(page.locator('[data-preview-metric="320"]')).toContainText('Showing the last authorized value.');
    await page.locator('#preview-direction').selectOption('rtl');
    await expect(page.locator('[data-preview-frame="320"]')).toHaveAttribute('dir', 'rtl');
    await page.locator('#preview-long-label').check();
    await expect(page.locator('[data-preview-metric="320"]')).toContainText('Total amount from the authorized employee population');
    await page.getByRole('button', {name: 'Dark'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('mounts the selected executable catalog example for all 71 component choices', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button', {name: 'Component Gallery'}).click();
    const chooser = page.locator('#gallery-component-select');
    await expect(chooser.locator('option')).toHaveCount(71);
    await expect(page.locator('[data-gallery-preview="metric"] aeliqo-metric')).toBeVisible();
    await chooser.selectOption('form-flow');
    await expect(page.locator('[data-gallery-preview="form-flow"] aeliqo-form-flow')).toBeVisible();
    await expect(page.locator('[data-gallery-component="form-flow"]')).toBeVisible();
    await expect(page.locator('#gallery-component-description')).not.toHaveText('');
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

test('dark previews inherit theme and narrow frames support keyboard inspection in both directions', async ({page}) => {
  await page.setViewportSize({width:360,height:800});
  await page.goto('/');
  await page.getByRole('button',{name:'Experience',exact:true}).click();
  await page.getByRole('button',{name:'Dark',exact:true}).click();
  const metric=page.locator('[data-preview-metric="1280"]');
  await expect(metric).toHaveAttribute('data-aeliqo-theme','dark');
  await expect(metric).toContainText('Total amount');
  expect(await metric.evaluate(element=>(element as HTMLElement & {unit?:string}).unit)).toBeUndefined();
  const viewport=page.getByRole('region',{name:'1280px preview',exact:true});
  await viewport.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(()=>viewport.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
  await page.locator('#preview-direction').selectOption('rtl');
  await expect(viewport).toHaveAttribute('dir','rtl');
  await viewport.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(()=>viewport.evaluate(element=>element.scrollLeft)).toBeLessThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/studio-review-browser/dark-narrow-rtl.png',fullPage:true});
  await page.getByRole('button',{name:'Component Gallery',exact:true}).click();
  await page.locator('#gallery-component-select').selectOption('form-flow');
  await expect(page.locator('#gallery-preview aeliqo-form-flow')).toHaveAttribute('data-aeliqo-theme','dark');
});
