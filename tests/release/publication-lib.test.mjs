import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {PUBLIC_PACKAGE_NAMES, sha256, sha512Integrity} from '../../scripts/release/candidate-lib.mjs';
import {
  assertApprovedRc, assertBootstrapAuthority, assertCandidateIdentity,
  assertTagMayAdvance, assertTrustedPublishingContext, expectedIntegrity,
  verifyNpmProvenance,
} from '../../scripts/release/publication-lib.mjs';

const sourceRevision = 'a'.repeat(40);
const packages = PUBLIC_PACKAGE_NAMES.map((name, index) => ({name, integrity: `sha512-${index}`, bytes: 1, file: `aeliqo-sdk-${name.slice('@aeliqo/sdk-'.length)}-0.1.0-rc.2.tgz`}));
const candidate = {schema: 'aeliqo.release-candidate.v1', sourceRevision, version: '0.1.0-rc.2', publishOrder: PUBLIC_PACKAGE_NAMES, packages};

test('first-RC bootstrap is a separate exact interactive path', () => {
  assert.doesNotThrow(() => assertCandidateIdentity(candidate, {tag: 'next'}));
  assert.throws(() => assertCandidateIdentity(candidate, {tag: 'rewrite'}), /RC candidates require next/);
  assert.throws(() => assertCandidateIdentity({...candidate, version: '0.1.0-rc.1'}, {tag: 'next'}), /reserved/);
  assert.doesNotThrow(() => assertCandidateIdentity({...candidate, version: '0.1.0-rc.1'}, {bootstrap: true, tag: 'next'}));
  assert.throws(() => assertCandidateIdentity({...candidate, version: '0.1.0-rc.2'}, {bootstrap: true, tag: 'next'}), /restricted/);
  const authority = {whoami: 'arconath', membership: {arconath: 'owner'}, tfa: {tfa: {mode: 'auth-and-writes'}}, stdinTTY: true, stdoutTTY: true, stderrTTY: true, ci: false};
  assert.doesNotThrow(() => assertBootstrapAuthority(authority));
  assert.throws(() => assertBootstrapAuthority({...authority, ci: true}), /interactive local terminal/);
  assert.throws(() => assertBootstrapAuthority({...authority, whoami: 'someone-else'}), /requires arconath/);
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
  const name = '@aeliqo/sdk-core';
  const version = '0.1.0-rc.2';
  const statement = {
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: [{name: 'pkg:npm/%40aeliqo/sdk-core@0.1.0-rc.2', digest: {sha512: Buffer.from(integrity.slice(7), 'base64').toString('hex')}}],
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
    const directory = name.slice('@aeliqo/sdk-'.length);
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
  assert.match(workflow, /--require-provenance-source "\$RC_SOURCE_SHA"/);
  assert.doesNotMatch(workflow, /bootstrap-first-rc/);
});
