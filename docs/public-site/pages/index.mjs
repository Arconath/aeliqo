import { agentPages } from './agents.mjs';
import { buildPages } from './build.mjs';
import { examplePages } from './examples.mjs';
import { referencePages } from './reference.mjs';
import { secondaryPages } from './secondary.mjs';
import { shipPages } from './ship.mjs';
import { startPages } from './start.mjs';
import { understandPages } from './understand.mjs';

export const pages = Object.freeze([
  ...startPages,
  ...buildPages,
  ...agentPages,
  ...understandPages,
  ...referencePages,
  ...shipPages,
  ...examplePages,
  ...secondaryPages,
]);

const ids = new Set();
const paths = new Set();
for (const page of pages) {
  if (ids.has(page.id)) throw new Error(`Duplicate documentation page ID ${page.id}.`);
  if (paths.has(page.path)) throw new Error(`Duplicate documentation path ${page.path}.`);
  ids.add(page.id);
  paths.add(page.path);
}
