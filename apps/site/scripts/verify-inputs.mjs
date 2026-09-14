#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {lstat, readFile, realpath, readdir} from 'node:fs/promises';
import {basename, join, relative, resolve, sep} from 'node:path';
import {loadPublicDocs} from '../../docs/docs-artifact.mjs';

const root = process.env.AELIQO_VERIFY_ROOT === undefined
  ? resolve(import.meta.dirname, '..')
  : resolve(process.env.AELIQO_VERIFY_ROOT);
const docsRoot = process.env.AELIQO_VERIFY_ROOT === undefined
  ? resolve(root, '../docs')
  : resolve(root, 'docs');
const packageRoot = resolve(root, 'vendor/packages');
const docsManifestPath = resolve(docsRoot, 'vendor/public-docs/manifest.json');
const expectedNames = ['@aeliqo/core', '@aeliqo/runtime', '@aeliqo/web', '@aeliqo/agent', '@aeliqo/devtools', '@aeliqo/react'];
const sha256 = value => createHash('sha256').update(value).digest('hex');

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function rejectSymlinks(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if ((await lstat(path)).isSymbolicLink()) throw new Error(`Vendored input may not be a symlink: ${relative(root, path)}`);
    if (entry.isDirectory()) await rejectSymlinks(path);
  }
}

if (process.versions.node !== '24.20.0') throw new Error(`Node 24.20.0 is required; received ${process.versions.node}`);
await rejectSymlinks(resolve(root, 'vendor'));
await rejectSymlinks(resolve(docsRoot, 'vendor'));
const canonicalPackageRoot = await realpath(packageRoot);
if (!canonicalPackageRoot.startsWith(`${await realpath(root)}${sep}`)) throw new Error('Package vendor directory escapes the site repository.');

const [sitePackage, workspace, candidate, consumer, secretScan, sbom, docs, docsChecksums] = await Promise.all([
  json(resolve(root, 'package.json')),
  readFile(resolve(root, 'pnpm-workspace.yaml'), 'utf8'),
  json(resolve(packageRoot, 'manifest.json')),
  json(resolve(packageRoot, 'consumer.json')),
  json(resolve(packageRoot, 'secret-scan.json')),
  json(resolve(packageRoot, 'sbom.cdx.json')),
  loadPublicDocs(docsManifestPath),
  readFile(resolve(docsRoot, 'vendor/public-docs/SHA256SUMS'), 'utf8'),
]);

if (candidate.schema !== 'aeliqo.release-candidate.v1' || candidate.version !== '0.1.0' || !/^[a-f0-9]{40}$/u.test(candidate.sourceRevision)) throw new Error('Invalid SDK candidate identity.');
if (sitePackage.name !== '@aeliqo/site-assembly' || sitePackage.private !== true || sitePackage.version !== candidate.version) throw new Error('Site assembly and SDK candidate versions differ.');
if (JSON.stringify(candidate.publishOrder) !== JSON.stringify(expectedNames)) throw new Error('SDK candidate publish order is incomplete.');
if (!Array.isArray(candidate.packages) || candidate.packages.length !== expectedNames.length) throw new Error('SDK candidate must contain all six public packages.');
for (const [index, item] of candidate.packages.entries()) {
  if (item.name !== expectedNames[index] || item.version !== candidate.version || typeof item.file !== 'string' || basename(item.file) !== item.file) throw new Error(`Invalid SDK candidate package ${item.name ?? index}.`);
  const bytes = await readFile(resolve(packageRoot, item.file));
  if (bytes.byteLength !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`SDK candidate integrity check failed: ${item.name}`);
}
if (consumer.schema !== 'aeliqo.local-tarball-consumer.v1' || consumer.sourceRevision !== candidate.sourceRevision || consumer.version !== candidate.version || consumer.exportCount !== 130 || consumer.execution?.networkDenied !== true || consumer.execution?.auditNetworkAttempts !== 0) throw new Error('Installed SDK consumer evidence is incomplete.');
if (secretScan.schema !== 'aeliqo.secret-scan.v1' || secretScan.sourceRevision !== candidate.sourceRevision || !Array.isArray(secretScan.scans) || secretScan.scans.some(scan => !Array.isArray(scan.findings) || scan.findings.length !== 0)) throw new Error('SDK candidate secret scan is incomplete or has findings.');
const sbomSource = sbom.metadata?.component?.properties?.find(property => property?.name === 'aeliqo:source-revision')?.value;
if (sbom.bomFormat !== 'CycloneDX' || sbom.specVersion !== '1.5' || sbom.version !== 1 || sbom.metadata?.component?.name !== 'aeliqo-release-candidate' || sbom.metadata.component.version !== candidate.version || sbomSource !== candidate.sourceRevision || !Array.isArray(sbom.components) || sbom.components.length !== 63) throw new Error('SDK candidate SBOM metadata is incomplete.');
const sbomReferences = sbom.components.map(component => component?.['bom-ref']);
if (sbomReferences.some(reference => typeof reference !== 'string') || new Set(sbomReferences).size !== sbomReferences.length) throw new Error('SDK candidate SBOM component identities are invalid.');
for (const item of candidate.packages) {
  const component = sbom.components.find(entry => entry?.name === item.name);
  const sourceRevision = component?.properties?.find(property => property?.name === 'aeliqo:source-revision')?.value;
  const tarball = component?.properties?.find(property => property?.name === 'aeliqo:tarball')?.value;
  const digest = component?.hashes?.find(hash => hash?.alg === 'SHA-256')?.content;
  if (component?.version !== candidate.version || component?.purl !== `pkg:npm/${item.name.replace('@', '%40')}@${candidate.version}` || sourceRevision !== candidate.sourceRevision || tarball !== item.file || digest !== item.sha256) throw new Error(`SDK candidate SBOM entry differs from ${item.name}.`);
}
if (docs.manifest.source.revision !== candidate.sourceRevision || docs.manifest.docsVersion !== candidate.version) throw new Error('SDK and documentation source identities differ.');
const expectedDocsChecksums = [docs.manifest.artifact, ...docs.manifest.catalogFiles]
  .map(item => `${item.sha256}  ${item.file ?? item.path}`)
  .join('\n') + '\n';
if (docsChecksums !== expectedDocsChecksums) throw new Error('Public documentation checksum inventory differs from its manifest.');

const dependencies = sitePackage.dependencies ?? {};
for (const name of ['@aeliqo/agent', '@aeliqo/core', '@aeliqo/runtime', '@aeliqo/web']) {
  const candidatePackage = candidate.packages.find(item => item.name === name);
  if (dependencies[name] !== `file:vendor/packages/${candidatePackage.file}`) throw new Error(`${name} must use its exact vendored candidate tarball.`);
}
for (const name of expectedNames) {
  const candidatePackage = candidate.packages.find(item => item.name === name);
  if (!workspace.includes(`'${name}': file:vendor/packages/${candidatePackage.file}`)) throw new Error(`${name} override must use its exact vendored candidate tarball.`);
}
const serializedDependencies = JSON.stringify({dependencies, devDependencies: sitePackage.devDependencies, workspace});
if (/workspace:|\.\.\/|(?:^|[^a-z])latest(?:[^a-z]|$)|github\.com\/Arconath\/aeliqo(?:#|\/tree\/)(?:main|master)/iu.test(serializedDependencies)) throw new Error('Mutable or cross-checkout dependency detected.');

process.stdout.write(`${JSON.stringify({sdkSourceRevision: candidate.sourceRevision, sdkVersion: candidate.version, packages: candidate.packages.length, exports: consumer.exportCount, sbomComponents: sbom.components.length, docsSha256: docs.manifest.artifact.sha256, docsPages: docs.artifact.pages.length, catalogFiles: docs.manifest.catalogFiles.length, secretFindings: 0})}\n`);
