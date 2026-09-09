import {expect, test} from 'vitest';
import {inspectWire, utf8Bytes} from '../../packages/core/src/contracts/ingress.js';
import {WIRE_LIMITS} from '../../packages/core/src/contracts/limits.js';

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
test('object byte accounting matches JSON at the exact boundary without a second serialization pass', () => {
  const unit = 'x'.repeat(16_000);
  const base = utf8Bytes(JSON.stringify({values: []}));
  const fullCount = Math.floor((WIRE_LIMITS.bytes - base + 1) / (unit.length + 3));
  const values = Array.from({length: fullCount}, () => unit);
  const used = base + fullCount * (unit.length + 2) + Math.max(0, fullCount - 1);
  const remainder = WIRE_LIMITS.bytes - used;
  expect(remainder).toBeGreaterThanOrEqual(3);
  values.push('x'.repeat(remainder - 3));
  const exact = {values};
  expect(utf8Bytes(JSON.stringify(exact))).toBe(WIRE_LIMITS.bytes);
  expect(inspectWire(exact).ok).toBe(true);
  expect(inspectWire({values: [...values, 'x']}) ).toMatchObject({ok: false, diagnostics: [{code: 'wire.bytes'}]});
});
test('escaped and unicode JSON strings use exact object byte accounting', () => {
  const marker = '"\\\b\t\n\f\r\u0000\u001f\u0080\u07ff\u0800🚀\ud800\udfff';
  const unit = 'x'.repeat(16_000);
  const base = utf8Bytes(JSON.stringify({[marker]: []}));
  const fullCount = Math.floor((WIRE_LIMITS.bytes - base) / (unit.length + 3));
  const values = [marker, ...Array.from({length: fullCount}, () => unit)];
  const used = base + utf8Bytes(JSON.stringify(marker)) + fullCount * (unit.length + 3);
  const remainder = WIRE_LIMITS.bytes - used;
  expect(remainder).toBeGreaterThanOrEqual(3);
  values.push('x'.repeat(remainder - 3));
  const exact = {[marker]: values};
  expect(utf8Bytes(JSON.stringify(exact))).toBe(WIRE_LIMITS.bytes);
  expect(inspectWire(exact).ok).toBe(true);
  expect(inspectWire({...exact, [marker]: [...values, 'x']})).toMatchObject({ok: false, diagnostics: [{code: 'wire.bytes'}]});
});
