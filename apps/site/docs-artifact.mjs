import {createHash} from 'node:crypto';
import {readFile, realpath} from 'node:fs/promises';
import {basename, dirname, resolve, sep} from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Load the public, source-versioned documentation input without reading an SDK checkout. */
export async function loadPublicDocs(manifestPath) {
  const absoluteManifest = await realpath(resolve(manifestPath));
  const base = dirname(absoluteManifest);
  const manifest = JSON.parse(await readFile(absoluteManifest, 'utf8'));
  if (manifest?.schema !== 'aeliqo.public-docs-manifest.v1') throw new Error('Unsupported public docs manifest schema.');
  if (typeof manifest.docsVersion !== 'string' || !/^0\.1\.0(?:-rc\.[1-9]\d*)?$/u.test(manifest.docsVersion)) throw new Error('Invalid public docs version.');
  if (typeof manifest.source?.revision !== 'string' || !/^[a-f0-9]{40}$/u.test(manifest.source.revision) || manifest.source.repository !== 'https://github.com/Arconath/aeliqo') throw new Error('Invalid public docs source identity.');
  const packageNames = ['@aeliqo/agent', '@aeliqo/core', '@aeliqo/devtools', '@aeliqo/react', '@aeliqo/runtime', '@aeliqo/web'];
  if (manifest.packageVersions === null || typeof manifest.packageVersions !== 'object' || Array.isArray(manifest.packageVersions) || JSON.stringify(Object.keys(manifest.packageVersions).sort()) !== JSON.stringify(packageNames)) throw new Error('Invalid public docs package set.');
  if (packageNames.some(name => manifest.packageVersions[name] !== manifest.docsVersion)) throw new Error('Public docs package versions are not exact.');
  if (typeof manifest.artifact?.file !== 'string' || basename(manifest.artifact.file) !== manifest.artifact.file) throw new Error('Invalid public docs artifact path.');
  if (typeof manifest.artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(manifest.artifact.sha256)) throw new Error('Invalid public docs checksum.');
  if (!Array.isArray(manifest.catalogFiles) || manifest.catalogFiles.length === 0 || !manifest.catalogFiles.some(file => file?.path === 'catalog-examples/index.ts')) throw new Error('Invalid public catalog example manifest.');
  const artifactPath = await realpath(resolve(base, manifest.artifact.file));
  if (dirname(artifactPath) !== base) throw new Error('Public docs artifact escapes its manifest directory.');
  const bytes = await readFile(artifactPath);
  if (bytes.byteLength !== manifest.artifact.bytes || sha256(bytes) !== manifest.artifact.sha256) throw new Error('Public docs artifact integrity check failed.');
  const artifact = JSON.parse(bytes.toString('utf8'));
  if (artifact?.schema !== 'aeliqo.public-docs.v1' || artifact.docsVersion !== manifest.docsVersion || !Array.isArray(artifact.pages)) throw new Error('Public docs artifact metadata is invalid.');
  if (artifact.pages.filter(page => typeof page?.component === 'string').length !== 71) throw new Error('Public docs artifact does not contain the complete component catalog.');
  const routes = artifact.pages.map(page => page?.path);
  if (routes.some(path => typeof path !== 'string' || !path.startsWith('/') || !path.endsWith('/') || path.startsWith('//') || path.includes('..')) || new Set(routes).size !== routes.length) throw new Error('Public docs routes are invalid.');
  if (!['/docs/', '/docs/components/', '/docs/search/'].every(path => routes.includes(path))) throw new Error('Public docs artifact is missing required routes.');
  if (JSON.stringify(artifact.source) !== JSON.stringify(manifest.source) || JSON.stringify(artifact.packageVersions) !== JSON.stringify(manifest.packageVersions)) throw new Error('Public docs artifact identity differs from its manifest.');
  for (const file of manifest.catalogFiles) {
    if (typeof file?.path !== 'string' || !file.path.startsWith('catalog-examples/') || !file.path.endsWith('.ts') || file.path.includes('..') || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(file.sha256)) throw new Error('Invalid public catalog example entry.');
    const filePath = await realpath(resolve(base, file.path));
    if (!filePath.startsWith(`${base}${sep}`)) throw new Error('Public catalog example escapes its manifest directory.');
    const fileBytes = await readFile(filePath);
    if (fileBytes.byteLength !== file.bytes || sha256(fileBytes) !== file.sha256) throw new Error(`Public catalog example integrity check failed: ${file.path}`);
  }
  return {artifact, manifest};
}
