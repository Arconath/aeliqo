import {expect, test} from 'vitest';
import {freezePresentation} from '../../packages/core/src/presentation/registry.js';

test('presentation freezing owns descendants of externally shallow-frozen objects', () => {
  const child = {values: ['owned']};
  const root = Object.freeze({child});
  freezePresentation(root);
  expect(Object.isFrozen(child)).toBe(true);
  expect(Object.isFrozen(child.values)).toBe(true);
  expect(() => child.values.push('changed')).toThrow();
  expect(freezePresentation({first: root, second: root}).first).toBe(root);
});
