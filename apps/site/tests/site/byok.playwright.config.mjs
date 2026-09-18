import base from './playwright.config.mjs';

export default {
  ...base,
  testMatch: 'byok.spec.ts',
  outputDir: '../../artifacts/site-browser/byok-output',
};
