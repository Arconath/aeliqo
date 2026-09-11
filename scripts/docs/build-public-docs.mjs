#!/usr/bin/env node
import {execFile} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {pages as authoredPages} from '../../docs/public-site/content.mjs';
import {componentApi, loadComponentSources} from './component-api.mjs';
import {PUBLIC_DOCS_MANIFEST_SCHEMA, PUBLIC_DOCS_SCHEMA, assertPublicDocsArtifact, assertPublicDocsManifest, sha256} from './public-docs-contract.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const arguments_ = process.argv.slice(2);
const outputIndex = arguments_.indexOf('--output');
const revisionIndex = arguments_.indexOf('--source-revision');
const versionIndex = arguments_.indexOf('--version');
const outputRoot = resolve(root, outputIndex === -1 ? 'artifacts/public-docs' : arguments_[outputIndex + 1] ?? '');

function command(commandName, args) {
  return execFileAsync(commandName, args, {cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
}

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function inlineCode(value) {
  return escape(value).replace(/`([^`]+)`/gu, '<code>$1</code>');
}

const listItems = (values, empty = 'None recorded in the inspected source.') => values.length
  ? values.map(value => `<li><code>${escape(value)}</code></li>`).join('')
  : `<li>${escape(empty)}</li>`;

async function filesAt(path, predicate = () => true) {
  const result = [];
  for (const item of await readdir(path, {withFileTypes: true})) {
    const itemPath = join(path, item.name);
    if (item.isDirectory()) result.push(...await filesAt(itemPath, predicate));
    else if (predicate(itemPath)) result.push(itemPath);
  }
  return result.sort();
}

function classDeclaration(text, name) {
  const start = text.indexOf(`export declare class ${name} `);
  if (start < 0) return undefined;
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error(`Unclosed declaration ${name}`);
}

async function loadCanonicalExamples() {
  const moduleUrl = pathToFileURL(resolve(root, 'examples/catalog/index.ts')).href;
  const script = `import(${JSON.stringify(moduleUrl)}).then(({catalogExamples})=>process.stdout.write(JSON.stringify(catalogExamples)))`;
  const loaderDirectory = await mkdtemp(join(tmpdir(), 'aeliqo-catalog-loader-'));
  const loaderPath = join(loaderDirectory, 'loader.mjs');
  try {
    await writeFile(loaderPath, "export async function resolve(specifier,context,nextResolve){if(context.parentURL?.includes('/examples/catalog/')&&specifier.startsWith('.')&&specifier.endsWith('.js'))return nextResolve(specifier.slice(0,-3)+'.ts',context);return nextResolve(specifier,context);}\n", 'utf8');
    const {stdout} = await command(process.execPath, ['--experimental-strip-types', '--experimental-loader', loaderPath, '--input-type=module', '-e', script]);
    const value = JSON.parse(stdout);
    if (!Array.isArray(value) || value.some(entry => entry === null || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.source !== 'string')) {
      throw new Error('Canonical catalog example metadata is unavailable.');
    }
    return value;
  } finally {
    await rm(loaderDirectory, {recursive: true, force: true}).catch(() => {});
  }
}

function exampleMarkup(metadata) {
  const list = value => value.map(item => escape(item)).join(', ');
  return `<div data-component-preview="${escape(metadata.family)}.${escape(metadata.id)}" data-preview-family="${escape(metadata.family)}" data-preview-id="${escape(metadata.id)}"><div class="component-preview" data-preview-mount data-preview-family="${escape(metadata.family)}" data-preview-id="${escape(metadata.id)}"><h2>Preview</h2><p class="component-preview-status" data-preview-status>Interactive preview requires JavaScript.</p></div><details class="component-example"><summary>Code and required setup</summary><pre tabindex="0"><code data-example-code="${escape(metadata.id)}">${escape(metadata.source)}</code></pre><button type="button" data-copy-example="${escape(metadata.id)}" disabled>Copy example</button><p class="component-copy-status" data-copy-status role="status"></p></details><h2>Input fixture</h2><p>${escape(metadata.fixture)}</p><h2>Expected result</h2><p>${escape(metadata.expectedOutcome)}</p><h2>Properties and host ownership</h2><p>${list(metadata.props)}. ${escape(metadata.propsNotes)}</p><h2>States</h2><p>${list(metadata.states)}</p><h2>Keyboard behavior</h2><p>${list(metadata.keyboard)}</p><h2>Events</h2><p>${list(metadata.events)}</p></div>`;
}

function componentDetails(component, example, metadata) {
  const initialized = metadata.properties.filter(property => property.default !== 'undefined').map(property => property.name);
  const sizing = metadata.sizing.length
    ? `Selected class-lineage styles declare ${metadata.sizing.map(name => `<code>${escape(name)}</code>`).join(', ')}. Conditional selectors and media queries determine their values.`
    : 'No sizing property was found in the selected class lineage; size is inherited or host-defined.';
  const bounds = metadata.bounds.length
    ? metadata.bounds.map(value => `<li>${inlineCode(value)}</li>`).join('')
    : '<li>No explicit source bound was found in the selected class lineage. Measure the composed workload in your environment.</li>';
  return `<section class="component-details" aria-labelledby="component-purpose"><h2 id="component-purpose">Purpose</h2><p>${escape(example.description)} ${escape(component.contract)}</p><h2>Do / don't</h2><ul><li><strong>Do:</strong> use the declared properties, explicit fixture, and host-owned event boundary shown below.</li><li><strong>Don't:</strong> treat the component as an authorization boundary, data source, or substitute for missing semantic evidence.</li></ul><h2>Dependencies</h2><p>These entries are imports referenced by the selected component class or its class lineage; they are not inferred from package installation.</p><ul>${listItems(metadata.dependencies)}</ul><p>Inspected repository source files: ${metadata.sourceFiles.map(file => `<code>${escape(file)}</code>`).join(', ') || 'not available'}.</p><h2>Controlled and uncontrolled use</h2><p>Public properties with source-declared construction initializers: ${initialized.length ? initialized.map(name => `<code>${escape(name)}</code>`).join(', ') : 'none'}. These initial values do not establish a controlled or uncontrolled contract. Treat the component’s documented events and behavior tests as authoritative.</p><h2>Semantic elements and accessibility hooks</h2><p>These native elements and attributes are present in the selected class-lineage render source; the example and browser checks remain the authoritative behavior evidence.</p><ul>${listItems(metadata.semantics)}</ul><h2>Sizing and adaptation</h2><p>${sizing} Browser behavior remains authoritative.</p><h2>Performance boundary</h2><ul>${bounds}</ul><h2>Changelog</h2><p><code>${escape(metadata.version)}</code> is the version marker declared by the component source. No compatibility with historical npm APIs is implied.</p></section>`;
}

function componentPage(component, example, metadata, api) {
  const properties = metadata.properties.map(property => `<tr><th scope="row"><code>${escape(property.name)}</code></th><td><code>${escape(property.type)}</code></td><td><code>${escape(property.default)}</code></td></tr>`).join('');
  return {
    path: `/docs/components/${component.id}/`,
    title: component.name,
    section: `Components / ${component.family}`,
    description: component.contract,
    component: component.id,
    body: `<p class="lead">${escape(component.contract)}</p>${exampleMarkup(example)}${componentDetails(component, example, metadata)}<h2>Properties and defaults</h2><p>Includes inherited public fields. Defaults below are read from the same source that builds this component. For unions and imported types, consult the generated declaration.</p><div class="api-table"><table><thead><tr><th>Property</th><th>Declared type</th><th>Initial value</th></tr></thead><tbody>${properties}</tbody></table></div><h2>Public parts and theme tokens</h2><p>Statically named shadow parts in the component and its base classes: ${metadata.parts.length ? metadata.parts.map(part => `<code>${escape(part)}</code>`).join(', ') : 'none declared in this class chain'}. Child components expose their own parts.</p><details><summary>Referenced theme tokens</summary><p>${metadata.tokens.length ? metadata.tokens.map(token => `<code>${escape(token)}</code>`).join(', ') : 'Uses the shared Aeliqo theme; no additional token references in this class chain.'}</p></details><h2 id="public-api-heading">Public API</h2><p>Generated from the built 0.1.0 declaration. Structured values are JavaScript properties; attribute forms are listed in the element’s property metadata.</p><div class="code-scroll" role="region" aria-labelledby="public-api-heading"><pre tabindex="0"><code>${escape(api)}</code></pre></div><h2>Verification status</h2><p>Implementation and focused package/browser checks are recorded for this component family. Full release visual, device, and manual assistive technology verification remains pending.</p><p><a href="/docs/production/">Accessibility, performance, and production considerations</a></p>`,
  };
}

async function packageVersions(targetVersion) {
  const result = {};
  for (const name of ['agent', 'core', 'devtools', 'react', 'runtime', 'web']) {
    const value = JSON.parse(await readFile(resolve(root, `packages/${name}/package.json`), 'utf8'));
    if (value.version !== '0.1.0') throw new Error(`${value.name} source manifest must remain at 0.1.0 before release staging.`);
    result[value.name] = targetVersion;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

async function publicPages() {
  const components = JSON.parse(await readFile(resolve(root, 'harness/components.json'), 'utf8')).components;
  if (!Array.isArray(components) || components.length !== 71) throw new Error('The public catalog must contain exactly 71 components.');
  const declarations = await Promise.all((await filesAt(resolve(root, 'packages/web/dist'), path => path.endsWith('.d.ts'))).map(async path => ({path, text: await readFile(path, 'utf8')})));
  const componentSources = await loadComponentSources(resolve(root, 'packages/web/src'));
  const canonicalExamples = await loadCanonicalExamples();
  const canonicalById = new Map(canonicalExamples.map(example => [`${example.family}.${example.id}`, example]));
  if (canonicalById.size !== 71) throw new Error('The runnable example catalog must contain exactly 71 unique entries.');
  const pages = authoredPages.map(page => ({...page}));
  pages.push({
    path: '/docs/components/', title: 'Component catalog', section: 'Components',
    description: '71 owned components, grouped by purpose.',
    body: `<p class="lead">Start with the component that serves the task. Each entry links to the actual generated public declaration.</p>${[...new Set(components.map(component => component.family))].map(family => `<h2 id="${family}">${family[0].toUpperCase() + family.slice(1)}</h2><ul class="component-links">${components.filter(component => component.family === family).map(component => `<li><a href="/docs/components/${component.id}/">${component.name}</a></li>`).join('')}</ul>`).join('')}`,
  });
  for (const component of components) {
    const className = `Aeliqo${component.name}Element`;
    const api = declarations.map(source => classDeclaration(source.text, className)).find(Boolean);
    if (!api) throw new Error(`Missing built public declaration ${className}`);
    const metadata = componentApi(componentSources, className);
    if (!metadata.properties.length) throw new Error(`Missing component source ${className}`);
    const example = canonicalById.get(component.id);
    if (example === undefined) throw new Error(`Missing canonical catalog example ${component.id}`);
    pages.push(componentPage(component, example, metadata, api));
  }
  const searchable = pages.filter(page => page.path.startsWith('/docs/'));
  pages.push({
    path: '/docs/search/', title: 'Search documentation', section: 'Documentation',
    description: 'Search Aeliqo documentation by title or description.',
    body: `<p class="lead">Search is progressively enhanced when JavaScript is available. Without it, this page remains a browsable list of documentation routes.</p><form class="docs-search-fallback" action="/docs/search/" method="get"><label for="docs-search-fallback-query">Search documentation</label><input id="docs-search-fallback-query" name="q" type="text" inputmode="search" placeholder="Component, concept, or integration"><button type="submit">Search</button></form><p class="caption">With JavaScript disabled, use your browser’s Find command after submitting the query.</p><nav aria-label="Documentation search fallback"><ul class="search-fallback-links">${searchable.map(page => `<li><a href="${page.path}">${escape(page.title)}</a><span>${escape(page.description)}</span></li>`).join('')}</ul></nav>`,
  });
  return pages;
}

async function sourceInputs() {
  const paths = [
    'docs/public-site/content.mjs',
    'harness/components.json',
    'scripts/docs/build-public-docs.mjs',
    'scripts/docs/component-api.mjs',
    'scripts/docs/public-docs-contract.mjs',
  ];
  for (const directory of ['examples/catalog', 'packages/web/src', 'packages/web/dist']) {
    for (const path of await filesAt(resolve(root, directory), path => /\.(?:json|ts)$/u.test(path))) paths.push(relative(root, path));
  }
  for (const name of ['agent', 'core', 'devtools', 'react', 'runtime', 'web']) paths.push(`packages/${name}/package.json`);
  const unique = [...new Set(paths)].sort();
  return Promise.all(unique.map(async path => {
    const bytes = await readFile(resolve(root, path));
    return {path, sha256: sha256(bytes), bytes: bytes.byteLength};
  }));
}

async function catalogArtifactFiles() {
  const sourceDirectory = resolve(root, 'examples/catalog');
  const files = await filesAt(sourceDirectory, path => path.endsWith('.ts'));
  return Promise.all(files.map(async sourcePath => {
    const bytes = await readFile(sourcePath);
    return {sourcePath, path: `catalog-examples/${basename(sourcePath)}`, sha256: sha256(bytes), bytes: bytes.byteLength};
  }));
}

async function sourceIdentity() {
  const revision = revisionIndex === -1
    ? (await command('git', ['rev-parse', 'HEAD'])).stdout.trim()
    : arguments_[revisionIndex + 1] ?? '';
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('The public docs artifact requires an exact 40-character source revision.');
  const sourceTree = (await command('git', ['status', '--porcelain', '--untracked-files=no'])).stdout.trim() === '' ? 'clean' : 'modified';
  return {source: {repository: 'https://github.com/Arconath/aeliqo', revision}, sourceTree};
}

async function main() {
  if ((outputIndex !== -1 && !arguments_[outputIndex + 1]) || (revisionIndex !== -1 && !arguments_[revisionIndex + 1]) || (versionIndex !== -1 && !arguments_[versionIndex + 1])) throw new Error('Missing option value.');
  const unexpected = arguments_.filter((value, index) => !['--output', '--source-revision', '--version'].includes(value) && !['--output', '--source-revision', '--version'].includes(arguments_[index - 1]));
  if (unexpected.length) throw new Error(`Unexpected arguments: ${unexpected.join(', ')}`);
  const docsVersion = versionIndex === -1 ? '0.1.0' : arguments_[versionIndex + 1];
  if (!/^0\.1\.0(?:-rc\.[1-9]\d*)?$/u.test(docsVersion)) throw new Error('The public docs artifact must use the 0.1.0 release lineage.');
  const versions = await packageVersions(docsVersion);
  const {source, sourceTree} = await sourceIdentity();
  const artifact = assertPublicDocsArtifact({schema: PUBLIC_DOCS_SCHEMA, docsVersion, source, packageVersions: versions, pages: await publicPages()});
  const artifactName = `aeliqo-public-docs-${docsVersion}.json`;
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  const catalogFiles = await catalogArtifactFiles();
  const manifest = assertPublicDocsManifest({
    schema: PUBLIC_DOCS_MANIFEST_SCHEMA,
    docsVersion,
    source,
    sourceTree,
    packageVersions: versions,
    artifact: {file: artifactName, sha256: sha256(artifactBytes), bytes: artifactBytes.byteLength},
    catalogFiles: catalogFiles.map(({path, sha256: digest, bytes}) => ({path, sha256: digest, bytes})),
    inputs: await sourceInputs(),
  });
  const directory = resolve(outputRoot, docsVersion);
  await mkdir(directory, {recursive: true});
  await mkdir(join(directory, 'catalog-examples'), {recursive: true});
  for (const file of catalogFiles) await copyFile(file.sourcePath, join(directory, file.path));
  await writeFile(join(directory, artifactName), artifactBytes);
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const checksums = [manifest.artifact, ...manifest.catalogFiles.map(file => ({file: file.path, sha256: file.sha256}))]
    .map(file => `${file.sha256}  ${file.file ?? file.path}`).join('\n');
  await writeFile(join(directory, 'SHA256SUMS'), `${checksums}\n`);
  process.stdout.write(`${JSON.stringify({directory: relative(root, directory), artifact: artifactName, sha256: manifest.artifact.sha256, pages: artifact.pages.length, sourceRevision: source.revision, sourceTree})}\n`);
}

await main();
