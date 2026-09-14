import {expect, test} from '@playwright/test';

test('holds a resize transition during focused IME draft and retries after focus release', async ({page}) => {
  await page.goto('/tests/runtime-presentation/browser/index.html');
  const editor = page.locator('aeliqo-region').locator('#editor');
  await editor.fill('draft');
  await editor.focus();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().state?.presentation)).toBeUndefined();
  const first = await page.evaluate(async () => (window as typeof window & {requestWide: () => Promise<unknown>}).requestWide());
  expect(first).toMatchObject({ok: true, value: {status: 'deferred', reason: 'transition-blocked'}});
  await page.evaluate(() => {
    const input = (document.querySelector('aeliqo-region') as HTMLElement).shadowRoot!.querySelector('#editor')!;
    input.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, composed: true}));
  });
  const blocked = await page.evaluate(async () => (window as typeof window & {requestNarrow: () => Promise<unknown>}).requestNarrow());
  expect(blocked).toMatchObject({ok: true, value: {status: 'deferred', reason: 'transition-blocked'}});
  const before = await page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().state?.presentation);
  expect(before).toBeUndefined();
  await page.evaluate(() => {
    const input = (document.querySelector('aeliqo-region') as HTMLElement).shadowRoot!.querySelector('#editor')!;
    input.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, composed: true}));
    (input as HTMLInputElement).blur();
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().state?.presentation?.nodes[0]?.representation.id)).toBe('layout.narrow');
  await expect.poll(() => page.locator('aeliqo-region').locator('#editor').inputValue()).toBe('draft');
  await expect.poll(() => page.evaluate(() => (window as typeof window & {editor: HTMLInputElement}).editor === document.activeElement)).toBe(false);
});

test('holds a transition during an active pointer drag and removes listeners on disconnect', async ({page}) => {
  await page.goto('/tests/runtime-presentation/browser/index.html');
  await page.evaluate(async () => (window as typeof window & {requestWide: () => Promise<unknown>}).requestWide());
  await page.evaluate(() => {
    const region = document.querySelector('aeliqo-region')!;
    region.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true, pointerId: 7, button: 0}));
  });
  const blocked = await page.evaluate(async () => (window as typeof window & {requestNarrow: () => Promise<unknown>}).requestNarrow());
  expect(blocked).toMatchObject({ok: true, value: {status: 'deferred', reason: 'transition-blocked'}});
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 7, button: 0})));
  await expect.poll(() => page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().state?.presentation?.nodes[0]?.representation.id)).toBe('layout.narrow');
  await page.evaluate(() => (window as typeof window & {adaptation: {disconnect: () => void}}).adaptation.disconnect());
  const before = await page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().regionRevision);
  await page.evaluate(async () => (window as typeof window & {requestWide: () => Promise<unknown>}).requestWide());
  await expect.poll(() => page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().regionRevision)).toBe(before);
});

test('guards focused editable controls when the region is mounted in a nested shadow tree', async ({page}) => {
  await page.goto('/tests/runtime-presentation/browser/index.html');
  await page.evaluate(async () => (window as typeof window & {requestWide: () => Promise<unknown>}).requestWide());
  await page.evaluate(() => {
    const region = document.querySelector('aeliqo-region')!;
    const outerHost = document.createElement('div');
    outerHost.id = 'outer-host';
    const outerRoot = outerHost.attachShadow({mode: 'open'});
    outerRoot.append(region);
    document.body.append(outerHost);
    (region.shadowRoot!.querySelector('#editor') as HTMLInputElement).focus();
  });
  const blocked = await page.evaluate(async () => (window as typeof window & {requestNarrow: () => Promise<unknown>}).requestNarrow());
  expect(blocked).toMatchObject({ok: true, value: {status: 'deferred', reason: 'transition-blocked'}});
  await page.evaluate(() => (document.querySelector('#outer-host')!.shadowRoot!.querySelector('aeliqo-region')!.shadowRoot!.querySelector('#editor') as HTMLInputElement).blur());
  await expect.poll(() => page.evaluate(() => (window as typeof window & {region: any}).region.snapshot().state?.presentation?.nodes[0]?.representation.id)).toBe('layout.narrow');
});
