import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {PUBLIC_PACKAGE_NAMES, sha256, sha512Integrity} from '../../scripts/release/candidate-lib.mjs';
import {
  assertApprovedRc, assertBootstrapAuthority, assertBootstrapPackageHistory, assertBootstrapRegistryReset, assertCandidateIdentity,
  assertCandidateTarball, assertTagMayAdvance, assertTrustedPublishingContext, bootstrapTagReconciliation, expectedIntegrity,
  verifyNpmProvenance,
} from '../../scripts/release/publication-lib.mjs';

const sourceRevision = 'a'.repeat(40);
const packages = PUBLIC_PACKAGE_NAMES.map((name, index) => ({name, version: '0.1.0-rc.2', sha256: String(index).padStart(64, '0'), integrity: `sha512-${index}`, bytes: 1, file: `aeliqo-${name.slice('@aeliqo/'.length)}-0.1.0-rc.2.tgz`}));
const candidate = {schema: 'aeliqo.release-candidate.v1', sourceRevision, version: '0.1.0-rc.2', publishOrder: PUBLIC_PACKAGE_NAMES, packages};
const withVersion = (value) => ({...candidate, version: value, packages: packages.map(item => ({...item, version: value, file: item.file.replace('0.1.0-rc.2', value)}))});

test('first-RC bootstrap is a separate exact interactive path', () => {
  assert.doesNotThrow(() => assertCandidateIdentity(candidate, {tag: 'next'}));
  assert.throws(() => assertCandidateIdentity(candidate, {tag: 'rewrite'}), /RC candidates require next/);
  assert.throws(() => assertCandidateIdentity(withVersion('0.1.0-rc.1'), {tag: 'next'}), /reserved/);
  assert.doesNotThrow(() => assertCandidateIdentity(withVersion('0.1.0-rc.1'), {bootstrap: true, tag: 'next'}));
  assert.throws(() => assertCandidateIdentity(withVersion('0.1.0-rc.2'), {bootstrap: true, tag: 'next'}), /restricted/);
  assert.throws(() => assertCandidateIdentity({...candidate, packages: candidate.packages.map((item, index) => index ? item : {...item, version: '9.9.9'})}, {tag: 'next'}), /metadata is invalid/);
  assert.throws(() => assertCandidateIdentity({...candidate, packages: candidate.packages.map((item, index) => index ? item : {...item, file: 'aeliqo-core-9.9.9.tgz'})}, {tag: 'next'}), /metadata is invalid/);
  const authority = {whoami: 'arconath', membership: {arconath: 'owner'}, tfa: {tfa: {mode: 'auth-and-writes'}}, stdinTTY: true, stdoutTTY: true, stderrTTY: true, ci: false};
  assert.doesNotThrow(() => assertBootstrapAuthority(authority));
  assert.throws(() => assertBootstrapAuthority({...authority, ci: true}), /interactive local terminal/);
  assert.throws(() => assertBootstrapAuthority({...authority, whoami: 'someone-else'}), /requires arconath/);
});

test('publication reopens each tarball and binds its internal public identity', () => {
  const item = packages[0];
  const manifest = {name: item.name, version: candidate.version, license: 'Apache-2.0', exports: {'.': './dist/index.js'}};
  const paths = ['package/', 'package/LICENSE', 'package/NOTICE', 'package/README.md', 'package/dist/index.js', 'package/package.json'];
  const canonicalLicense = Buffer.from('license');
  const canonicalNotice = Buffer.from('notice');
  const input = {item, candidateVersion: candidate.version, manifest, paths, license: canonicalLicense, notice: canonicalNotice, canonicalLicense, canonicalNotice};
  assert.doesNotThrow(() => assertCandidateTarball(input));
  assert.throws(() => assertCandidateTarball({...input, manifest: {...manifest, name: '@aeliqo/runtime'}}), /Expected @aeliqo\/core/);
  assert.throws(() => assertCandidateTarball({...input, manifest: {...manifest, version: '9.9.9'}}), /must be version/);
  assert.throws(() => assertCandidateTarball({...input, notice: Buffer.from('changed')}), /NOTICE differs/);
});

test('first-RC package history permits only an exact partial-publication resume', () => {
  const name = '@aeliqo/core';
  const version = '0.1.0-rc.1';
  assert.doesNotThrow(() => assertBootstrapPackageHistory({name, version, identityExists: false, registryVersions: [], versionState: 'absent'}));
  assert.doesNotThrow(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: ['0.2.0'], deprecatedVersions: ['0.2.0'], versionState: 'absent'}));
  assert.doesNotThrow(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: ['0.2.0', version], deprecatedVersions: ['0.2.0'], versionState: 'verified-existing'}));
  assert.doesNotThrow(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: [version], deprecatedVersions: [], versionState: 'verified-existing'}));
  assert.throws(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: [], versionState: 'absent'}), /unused package identity/);
  assert.throws(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: ['0.2.0'], deprecatedVersions: [], versionState: 'absent'}), /deprecated legacy history/);
  assert.throws(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: ['0.0.9'], deprecatedVersions: [], versionState: 'absent'}), /deprecated legacy history/);
  assert.throws(() => assertBootstrapPackageHistory({name, version, identityExists: true, registryVersions: ['0.2.0', version, '0.1.0-rc.0'], deprecatedVersions: ['0.2.0'], versionState: 'verified-existing'}), /deprecated legacy history/);
  assert.doesNotThrow(() => assertBootstrapPackageHistory({name: '@aeliqo/runtime', version, identityExists: true, registryVersions: [version], versionState: 'verified-existing'}));
  assert.throws(() => assertBootstrapPackageHistory({name: '@aeliqo/runtime', version, identityExists: true, registryVersions: [version], deprecatedVersions: [version], versionState: 'verified-existing'}), /deprecated candidate/);
});

test('owner-unpublished names require the conservative hold and a fresh post-hold preflight', () => {
  const notBefore = '2026-09-11T16:32:51Z';
  const preflight = {
    target: '0.1.0',
    registry: 'https://registry.npmjs.org',
    registryRead: 'verified',
    namespaceAuthority: 'verified',
    observedAt: '2026-09-11T16:33:00Z',
    packages: PUBLIC_PACKAGE_NAMES.map(name => ({name, registryStatus: 'public-404-post-hold', exactTarget: 'not-visible'})),
    ownerUnpublishedHistory: [
      '@aeliqo/core@0.2.0', '@aeliqo/react@0.2.0', '@aeliqo/mcp@0.2.0',
      '@aeliqo/byok@0.2.0', '@aeliqo/webmcp-experimental@0.2.0', '@aeliqo/sdk-core@0.1.0-rc.1',
    ],
    conservativePublishNotBefore: notBefore,
    postHoldVerifiedAt: '2026-09-11T16:33:00Z',
  };
  assert.throws(() => assertBootstrapRegistryReset(preflight, Date.parse('2026-09-11T16:32:50Z')), /24-hour package-name hold/);
  assert.doesNotThrow(() => assertBootstrapRegistryReset(preflight, Date.parse('2026-09-11T16:33:01Z')));
  assert.throws(() => assertBootstrapRegistryReset({...preflight, postHoldVerifiedAt: null}, Date.parse('2026-09-11T16:33:01Z')), /fresh authenticated post-hold/);
  assert.throws(() => assertBootstrapRegistryReset({...preflight, packages: preflight.packages.slice(1)}, Date.parse('2026-09-11T16:33:01Z')), /exact direct six-package/);
  assert.throws(() => assertBootstrapRegistryReset({...preflight, ownerUnpublishedHistory: []}, Date.parse('2026-09-11T16:33:01Z')), /known unpublished/);
  assert.throws(() => assertBootstrapRegistryReset({...preflight, observedAt: '2026-09-11T16:32:59Z'}, Date.parse('2026-09-11T16:33:01Z')), /fresh authenticated/);
  assert.throws(() => assertBootstrapRegistryReset({...preflight, registry: 'https://registry.example.test'}, Date.parse('2026-09-11T16:33:01Z')), /exact authenticated/);
});

test('first publication removes only an automatically-created prerelease latest tag', () => {
  const input = {name: '@aeliqo/runtime', desiredVersion: '0.1.0-rc.1', beforeTags: {}, afterTags: {next: '0.1.0-rc.1', latest: '0.1.0-rc.1'}};
  assert.deepEqual(bootstrapTagReconciliation(input), {removeTags: ['latest'], expectedTags: {next: '0.1.0-rc.1'}});
  assert.deepEqual(bootstrapTagReconciliation({...input, afterTags: {next: '0.1.0-rc.1'}}), {removeTags: [], expectedTags: {next: '0.1.0-rc.1'}});
  assert.deepEqual(bootstrapTagReconciliation({
    ...input, name: '@aeliqo/core', beforeTags: {latest: '0.2.0'},
    afterTags: {latest: '0.2.0', next: '0.1.0-rc.1'},
  }), {removeTags: [], expectedTags: {latest: '0.2.0', next: '0.1.0-rc.1'}});
  assert.throws(() => bootstrapTagReconciliation({...input, afterTags: {next: '0.1.0-rc.1', beta: '9.9.9'}}), /unexpected dist-tags/);
  assert.throws(() => bootstrapTagReconciliation({...input, afterTags: {latest: '0.1.0-rc.1'}}), /next does not select/);
});

test('trusted publishing and dist-tag movement fail closed', () => {
  const environment = {
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Arconath/aeliqo', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main', GITHUB_ACTOR: 'hermawan22', GITHUB_TRIGGERING_ACTOR: 'hermawan22', GITHUB_SHA: sourceRevision,
  };
  assert.doesNotThrow(() => assertTrustedPublishingContext(environment, sourceRevision));
  assert.throws(() => assertTrustedPublishingContext({...environment, GITHUB_REF: 'refs/heads/other'}, sourceRevision), /canonical current-main/);
  assert.doesNotThrow(() => assertTagMayAdvance({name: packages[0].name, tag: 'next', desiredVersion: '0.1.0-rc.3', currentVersion: '0.1.0-rc.2', versionAlreadyExists: false}));
  assert.throws(() => assertTagMayAdvance({name: packages[0].name, tag: 'next', desiredVersion: '0.1.0-rc.2', currentVersion: '0.1.0-rc.3', versionAlreadyExists: false}), /Refusing to move/);
  assert.throws(() => assertTagMayAdvance({name: packages[0].name, tag: 'next', desiredVersion: '0.1.0-rc.2', currentVersion: undefined, versionAlreadyExists: true}), /exists but dist-tag/);
});

test('approved RC records bind source and all candidate integrities', () => {
  const publication = {schema: 'aeliqo.npm-publication.v2', sourceRevision, version: candidate.version, tag: 'next', mode: 'trusted-publishing', completedAt: 'now', packages};
  const consumer = {schema: 'aeliqo.registry-consumer.v2', expectedSourceRevision: sourceRevision, provenanceVerified: true, version: candidate.version, packages};
  assert.doesNotThrow(() => assertApprovedRc({candidate, publication, consumer, version: candidate.version, sourceRevision}));
  assert.throws(() => assertApprovedRc({candidate, publication: {...publication, mode: 'interactive-owner-bootstrap'}, consumer, version: candidate.version, sourceRevision}), /trusted publishing/);
  assert.throws(() => assertApprovedRc({candidate, publication, consumer: {...consumer, packages: consumer.packages.slice(1)}, version: candidate.version, sourceRevision}), /each public package/);
});

test('npm provenance binds package bytes to canonical workflow and source', () => {
  const bytes = Buffer.from('candidate');
  const integrity = sha512Integrity(bytes);
  const name = '@aeliqo/core';
  const version = '0.1.0-rc.2';
  const statement = {
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: [{name: 'pkg:npm/%40aeliqo/core@0.1.0-rc.2', digest: {sha512: Buffer.from(integrity.slice(7), 'base64').toString('hex')}}],
    predicate: {buildDefinition: {
      externalParameters: {workflow: {repository: 'https://github.com/Arconath/aeliqo', ref: 'refs/heads/main', path: '/.github/workflows/release-publish.yml'}},
      internalParameters: {github: {event_name: 'workflow_dispatch'}},
      resolvedDependencies: [{uri: 'git+https://github.com/Arconath/aeliqo@refs/heads/main', digest: {gitCommit: sourceRevision}}],
    }, runDetails: {builder: {id: 'https://github.com/actions/runner/github-hosted'}}},
  };
  const audit = {verified: [{name, version, attestationBundles: [{predicateType: statement.predicateType, bundle: {dsseEnvelope: {payload: Buffer.from(JSON.stringify(statement)).toString('base64')}}}]}]};
  assert.equal(verifyNpmProvenance(audit, {name, version, integrity, sourceRevision}).sourceRevision, sourceRevision);
  assert.throws(() => verifyNpmProvenance(audit, {name, version, integrity, sourceRevision: 'b'.repeat(40)}), /lacks canonical/);
  assert.equal(expectedIntegrity(bytes, {name, bytes: bytes.length, sha256: sha256(bytes), integrity}), integrity);
});

test('all public packages carry the canonical full LICENSE and NOTICE', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const [license, notice] = await Promise.all([readFile(resolve(root, 'LICENSE')), readFile(resolve(root, 'NOTICE'))]);
  assert.ok(license.length > 10_000);
  for (const name of PUBLIC_PACKAGE_NAMES) {
    const directory = name.slice('@aeliqo/'.length);
    assert.deepEqual(await readFile(resolve(root, 'packages', directory, 'LICENSE')), license);
    assert.deepEqual(await readFile(resolve(root, 'packages', directory, 'NOTICE')), notice);
  }
});

test('package workflow serializes publication and binds quality plus approved RC evidence', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const workflow = await readFile(resolve(root, '.github/workflows/release-publish.yml'), 'utf8');
  assert.match(workflow, /group: aeliqo-npm-publication\n/);
  assert.match(workflow, /test "\$GH_REPO" = "Arconath\/aeliqo"/);
  assert.match(workflow, /test "\$ACTOR" = "hermawan22"/);
  assert.match(workflow, /branches\/main/);
  assert.match(workflow, /actions\/workflows\/quality\.yml\/runs/);
  assert.match(workflow, /aeliqo-quality-evidence-\$GITHUB_SHA/);
  assert.match(workflow, /verify-approved-rc\.mjs/);
  assert.match(workflow, /\[ "\$RC_SOURCE_SHA" = "\$SOURCE_SHA" \]/);
  assert.match(workflow, /--require-provenance-source "\$RC_SOURCE_SHA"/);
  assert.doesNotMatch(workflow, /bootstrap-first-rc/);
});

test('bootstrap, registry consumer, and legacy mutations are pinned to npmjs', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const [publish, consumer, legacy, preflight, rootManifest] = await Promise.all([
    readFile(resolve(root, 'scripts/release/publish.mjs'), 'utf8'),
    readFile(resolve(root, 'scripts/release/registry-consumer.mjs'), 'utf8'),
    readFile(resolve(root, 'scripts/release/deprecate-legacy.mjs'), 'utf8'),
    readFile(resolve(root, 'scripts/release/refresh-bootstrap-preflight.mjs'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
  ]);
  for (const source of [publish, consumer, legacy, preflight]) assert.match(source, /NPM_REGISTRY/);
  assert.match(publish, /dist-tag', 'rm'.*--registry/);
  assert.match(consumer, /install'.*--registry/);
  assert.match(legacy, /\.\.\.args, '--registry'/);
  assert.match(preflight, /access', 'list', 'packages'.*--json/);
  assert.equal(JSON.parse(rootManifest).scripts['release:bootstrap:preflight'], 'node scripts/release/refresh-bootstrap-preflight.mjs');
});
