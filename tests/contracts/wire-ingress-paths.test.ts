import {expect, test} from 'vitest';
import {inspectWire, utf8Bytes} from '../../packages/core/src/contracts/ingress.js';

test('wire diagnostics retain exact object and array paths', () => {
  const invalid = inspectWire({output: [{values: [0, NaN]}]});
  expect(invalid).toMatchObject({ok: false, diagnostics: [{code: 'wire.number', path: ['output', 0, 'values', 1]}]});
  const accessor = Object.defineProperty({}, 'hidden', {get() {throw Error('Must not execute');}, enumerable: true});
  expect(inspectWire({output: [accessor]})).toMatchObject({ok: false, diagnostics: [{code: 'wire.accessor', path: ['output', 0, 'hidden']} ]});
});
test('wire paths distinguish shared references from ancestor cycles', () => {
  const shared = {value: 1};
  expect(inspectWire({a: shared, b: shared}).ok).toBe(true);
  const cyclic: {child?: unknown} = {};
  cyclic.child = [cyclic];
  expect(inspectWire(cyclic)).toMatchObject({ok: false, diagnostics: [{code: 'wire.cycle', path: ['child', 0]}]});
});
test('depth limits retain the bounded diagnostic path', () => {
  let deep: unknown = false;
  for (let index = 0; index < 66; index++) deep = {child: deep};
  const checked = inspectWire(deep);
  expect(checked).toMatchObject({ok: false, diagnostics: [{code: 'wire.depth', path: Array(64).fill('child')}]});
});
test('ASCII byte fast path preserves UTF-8 accounting', () => {
  for (const text of ['', 'plain ASCII\n', '\u0000\u007f', 'café', '漢字', '🚀', '\ud800']) {
    expect(utf8Bytes(text)).toBe(new TextEncoder().encode(text).byteLength);
  }
});
