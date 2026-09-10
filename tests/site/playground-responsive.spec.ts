import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test('task chooser, inspector summaries, and actionable recovery form a complete people journey', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/playground/');
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  await expect(page.locator('#workflow-meter')).toHaveAttribute('value', '1');
  await page.locator('#task-choice').selectOption('people-rank');
  await page.getByRole('button', {name: 'Run task'}).click();
  await expect(page.getByRole('alert')).toContainText('Define absence days');
  await page.getByRole('button', {name: 'Define absence days', exact: true}).click();
  await expect(page.locator('#workflow-progress')).toContainText('Absence-days meaning defined');
  await page.getByRole('button', {name: 'Freeze current people', exact: true}).click();
  await page.locator('#task-choice').selectOption('people-trend');
  await page.getByRole('button', {name: 'Run task'}).click();
  await expect(page.locator('aeliqo-trend')).toBeVisible();
  await expect(page.locator('#workflow-meter')).toHaveAttribute('value', '4');
  await page.getByRole('button', {name: 'Inspect', exact: true}).click();
  await page.locator('#inspector-tab').selectOption('Data');
  await expect(page.locator('#inspector-content')).toContainText('scopeDigest');
  await expect(page.locator('#inspector-content')).toContainText('rowCount');
  await expect(page.locator('#inspector-content')).not.toContainText('Ada Chen');
  await page.locator('#inspector-resize').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#inspector-resize')).toHaveAttribute('aria-valuetext', '520 pixels');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  const sourceHandle = page.locator('#source-resize');
  const sourceBox = await sourceHandle.boundingBox();
  if (!sourceBox) throw Error('source resize handle is not visible');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 80);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 48, sourceBox.y + 80, {steps: 3});
  await page.mouse.up();
  expect(Number(await sourceHandle.getAttribute('aria-valuenow'))).toBeGreaterThan(320);
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export Task + presentation'}).click();
  expect((await download).suggestedFilename()).toBe('aeliqo-playground.json');
  await page.locator('#task-choice').selectOption('people-periods');
  await page.evaluate(() => {
    (document.querySelector('#run-task') as HTMLButtonElement).click();
    (document.querySelector('#cancel') as HTMLButtonElement).click();
  });
  await expect(page.locator('#play-status')).toContainText('cancelled');
  await expect(page.locator('aeliqo-region')).toBeVisible();
  expect(errors).toEqual([]);
});

test('source records, guarded reset, commerce progress, and narrow drawers remain usable', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('/playground/');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  await expect(page.locator('#source-panel')).toHaveAttribute('aria-modal', 'true');
  const mobileAxe = await new AxeBuilder({page}).include('.playground-layout').analyze();
  expect(mobileAxe.violations).toEqual([]);
  expect(mobileAxe.incomplete.filter(({id}) => id === 'aria-allowed-role' || id === 'aria-prohibited-attr')).toEqual([]);
  await page.locator('#source-section').selectOption('dataset');
  await expect(page.locator('#source-content')).toContainText('People & absence');
  await page.keyboard.press('Escape');
  await expect(page.locator('#source-toggle')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#dataset').selectOption('products');
  await expect(page.locator('#commerce-progress')).toContainText('Step 2 of 3');
  await page.getByRole('textbox', {name: 'Your name', exact: true}).fill('Nino');
  await page.getByRole('button', {name: 'Review local enquiry'}).click();
  await expect(page.locator('#commerce-progress')).toContainText('Step 3 of 3');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  await page.locator('#source-section').selectOption('task');
  await page.locator('#task-draft').fill('{"local":"draft"}');
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('discard your local drafts');
    await dialog.dismiss();
  });
  await page.getByRole('button', {name: 'Reset session'}).click();
  await expect(page.locator('#dataset')).toHaveValue('products');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: 'Reset session'}).click();
  await expect(page.locator('#dataset')).toHaveValue('employees');
  await expect(page.locator('#play-status')).toContainText('4 result rows');
  expect(errors).toEqual([]);
});

test('the complete toolbar reflows without page overflow at 320 pixels', async ({page}) => {
  await page.setViewportSize({width: 320, height: 800});
  await page.goto('/playground/');
  for (const theme of ['light', 'dark']) {
    await page.locator('#theme').selectOption(theme);
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(value => { document.documentElement.dir = value; }, direction);
      await page.locator('#dataset').selectOption('products');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const toolbar = await page.locator('.playground-toolbar').boundingBox();
      const task = await page.locator('#task-choice').boundingBox();
      expect(toolbar).not.toBeNull();
      expect(task).not.toBeNull();
      expect(task!.x).toBeGreaterThanOrEqual(toolbar!.x);
      expect(task!.x + task!.width).toBeLessThanOrEqual(toolbar!.x + toolbar!.width + 0.5);
    }
  }
  const axe = await new AxeBuilder({page}).analyze();
  expect(axe.violations).toEqual([]);
});

test('reset protects a reviewed but unsent commerce draft', async ({page}) => {
  await page.goto('/playground/');
  await page.locator('#dataset').selectOption('products');
  await page.getByRole('textbox', {name: 'Your name', exact: true}).fill('Nino');
  await page.getByRole('textbox', {name: 'Enquiry note', exact: true}).fill('Keep this local draft.');
  await page.getByRole('button', {name: 'Review local enquiry', exact: true}).click();
  await expect(page.locator('#commerce-form [role=status]')).toContainText('remains local');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('discard your local drafts');
    await dialog.dismiss();
  });
  await page.getByRole('button', {name: 'Reset session'}).click();
  await expect(page.locator('#dataset')).toHaveValue('products');
  await expect(page.getByRole('textbox', {name: 'Your name', exact: true})).toHaveValue('Nino');
  await expect(page.getByRole('textbox', {name: 'Enquiry note', exact: true})).toHaveValue('Keep this local draft.');
});

test('medium desktop panels preserve a usable result canvas and expose valid panel semantics', async ({page}) => {
  await page.setViewportSize({width: 1024, height: 800});
  await page.goto('/playground/');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  await page.getByRole('button', {name: 'Inspect', exact: true}).click();
  await page.locator('#source-resize').focus();
  await page.keyboard.press('End');
  await page.locator('#inspector-resize').focus();
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const main = await page.locator('.playground-main').boundingBox();
  expect(main?.width ?? 0).toBeGreaterThanOrEqual(280);
  const axe = await new AxeBuilder({page}).include('.playground-layout').analyze();
  expect(axe.violations).toEqual([]);
  expect(axe.incomplete.filter(({id}) => id === 'aria-allowed-role' || id === 'aria-prohibited-attr')).toEqual([]);
});

test('medium desktop separators expose achievable ranges and resize only their own panel', async ({page}) => {
  for (const width of [1024, 1100]) {
    await page.setViewportSize({width, height: 800});
    await page.goto('/playground/');
    await page.getByRole('button', {name: 'Source', exact: true}).click();
    await page.getByRole('button', {name: 'Inspect', exact: true}).click();
    const source = page.locator('#source-resize');
    const inspector = page.locator('#inspector-resize');
    const initialSource = Number(await source.getAttribute('aria-valuenow'));
    const initialInspector = Number(await inspector.getAttribute('aria-valuenow'));
    const achievableMaximum = Number(await source.getAttribute('aria-valuemax'));
    expect(achievableMaximum).toBeGreaterThanOrEqual(initialSource);
    expect(achievableMaximum).toBeLessThanOrEqual(520);

    await source.focus();
    await page.keyboard.press('Home');
    await expect(source).toHaveAttribute('aria-valuenow', '260');
    await expect(inspector).toHaveAttribute('aria-valuenow', String(initialInspector));
    await page.keyboard.press('End');
    await expect(source).toHaveAttribute('aria-valuenow', String(achievableMaximum));
    await expect(inspector).toHaveAttribute('aria-valuenow', String(initialInspector));
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw Error('source resize handle is not visible');
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x - 32, sourceBox.y + 80, {steps: 3});
    await page.mouse.up();
    expect(Number(await source.getAttribute('aria-valuenow'))).toBeLessThan(achievableMaximum);
    await expect(inspector).toHaveAttribute('aria-valuenow', String(initialInspector));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.locator('.playground-main').boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(280);
  }
});

test('panel adaptation moves focus into the surviving or newly modal panel', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/playground/');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  await page.getByRole('button', {name: 'Inspect', exact: true}).click();
  await page.locator('#source-section').focus();
  await page.setViewportSize({width: 901, height: 800});
  await expect(page.locator('#source-panel')).toBeHidden();
  await expect(page.locator('#inspector-panel')).toBeVisible();
  await expect(page.locator('#inspector-tab')).toBeFocused();

  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/playground/');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  await page.getByRole('button', {name: 'Run task'}).focus();
  await page.setViewportSize({width: 768, height: 800});
  await expect(page.locator('#source-panel')).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#source-panel')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#source-section')).toBeFocused();
});

test('RTL results and splitters follow the document direction', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/playground/');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await page.getByRole('button', {name: 'Browse people', exact: true}).click();
  await expect(page.locator('aeliqo-region [part="region"]').first()).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', {name: 'Source', exact: true}).click();
  const handle = page.locator('#source-resize');
  const before = Number(await handle.getAttribute('aria-valuenow'));
  const box = await handle.boundingBox();
  if (!box) throw Error('source resize handle is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x - 48, box.y + 80, {steps: 3});
  await page.mouse.up();
  const afterPointer = Number(await handle.getAttribute('aria-valuenow'));
  expect(afterPointer).toBeGreaterThan(before);
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(afterPointer);
});

test('contributor control is scoped to the contributor task', async ({page}) => {
  await page.goto('/playground/');
  await expect(page.locator('#contributor-control')).toBeHidden();
  await page.getByRole('button', {name: 'Inspect records', exact: true}).click();
  await expect(page.locator('#contributor-control')).toBeVisible();
  await page.getByRole('button', {name: 'Rank absence days', exact: true}).click();
  await expect(page.locator('#contributor-control')).toBeHidden();
});
