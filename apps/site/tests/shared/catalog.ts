import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

type DocsPage = {readonly component?: unknown; readonly title?: unknown};
type DocsArtifact = {readonly pages?: unknown};

const artifact = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vendor/public-docs/aeliqo-public-docs-0.1.0-rc.2.json'), 'utf8'),
) as DocsArtifact;

if (!Array.isArray(artifact.pages)) throw new Error('Vendored public docs pages are missing.');

export const componentCatalog = (artifact.pages as readonly DocsPage[])
  .filter((page): page is {readonly component: string; readonly title: string} =>
    typeof page.component === 'string' && typeof page.title === 'string')
  .map(({component, title}) => ({id: component, name: title}));

if (componentCatalog.length !== 71) throw new Error('Vendored public docs do not contain all 71 components.');
