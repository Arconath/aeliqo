import {
  PUBLIC_PACKAGE_NAMES,
  assertExportTargets,
  assertPublicManifest,
  assertTarballPaths,
  packagePurl,
  packageShortName,
  sha256,
  sha512Integrity,
} from './candidate-lib.mjs';
import { isReleaseVersion, RELEASE_VERSION, releaseCandidateNumber } from './metadata.mjs';

export const NPM_REGISTRY = 'https://registry.npmjs.org';
export const GITHUB_REPOSITORY = 'Arconath/aeliqo';
export const GITHUB_OWNER = 'hermawan22';
export const RELEASE_WORKFLOW = '.github/workflows/release-publish.yml';

function registryUnpublishedVersions(payload, name, publishedVersions) {
  const time = payload?.time;
  if (time !== undefined && (!time || typeof time !== 'object' || Array.isArray(time))) {
    throw new Error(`Registry returned malformed ${name} publication history`);
  }
  const orphanedTimeEntries = Object.keys(time ?? {}).filter(
    (key) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(key) && !publishedVersions.includes(key),
  );
  const unpublished = payload?.time?.unpublished;
  if (unpublished === undefined) return orphanedTimeEntries.sort();
  if (!unpublished || typeof unpublished !== 'object' || Array.isArray(unpublished)) {
    throw new Error(`Registry returned malformed ${name} unpublished history`);
  }
  const versions = unpublished.versions;
  if (!Array.isArray(versions) || versions.some((version) => typeof version !== 'string')) {
    throw new Error(`Registry returned malformed ${name} unpublished versions`);
  }
  return [...new Set([...versions, ...orphanedTimeEntries])].sort();
}

export function classifyRegistryPackageResponse(status, payload, name, tag = 'next') {
  const absent = {
    exists: false,
    selected: undefined,
    tags: {},
    versions: [],
    unpublishedVersions: [],
    deprecatedVersions: [],
  };
  if (status === 404) return absent;
  if (status !== 200) throw new Error(`Registry returned HTTP ${status} for ${name} dist-tags`);

  const tags = payload?.['dist-tags'];
  const versions = payload?.versions;
  const publishedVersions =
    versions && typeof versions === 'object' && !Array.isArray(versions) ? Object.keys(versions) : [];
  const unpublishedVersions = registryUnpublishedVersions(payload, name, publishedVersions);
  const emptyUnpublishedTombstone =
    payload?.name === name &&
    typeof payload?._rev === 'string' &&
    payload._rev.length > 0 &&
    payload?.time?.unpublished &&
    typeof payload.time.unpublished === 'object' &&
    !Array.isArray(payload.time.unpublished) &&
    tags === undefined &&
    versions === undefined;
  if (emptyUnpublishedTombstone) return { ...absent, unpublishedVersions };
  if (!tags || typeof tags !== 'object' || Array.isArray(tags))
    throw new Error(`Registry returned malformed ${name} dist-tags`);
  if (!versions || typeof versions !== 'object' || Array.isArray(versions))
    throw new Error(`Registry returned malformed ${name} version history`);

  const selected = tags[tag];
  if (selected !== undefined && typeof selected !== 'string')
    throw new Error(`Registry returned malformed ${name} dist-tag ${tag}`);
  const deprecatedVersions = Object.entries(versions)
    .filter(([, manifest]) => typeof manifest?.deprecated === 'string' && manifest.deprecated.trim())
    .map(([version]) => version)
    .sort();
  return {
    exists: true,
    selected,
    tags,
    versions: Object.keys(versions).sort(),
    unpublishedVersions,
    deprecatedVersions,
  };
}

export function assertRegistryVersionAvailable(name, version, state) {
  if (state.unpublishedVersions.includes(version)) {
    throw new Error(`${name}@${version} was previously unpublished and npm will not accept that version again`);
  }
  if (state.versions.includes(version)) {
    throw new Error(`${name}@${version} is already published`);
  }
}

export function assertRegistryVersionNotUnpublished(name, version, state) {
  if (state.unpublishedVersions.includes(version)) {
    throw new Error(`${name}@${version} was previously unpublished and cannot be resumed or republished`);
  }
}

export function assertCandidateIdentity(candidate, { tag } = {}) {
  const names = candidate?.packages?.map((item) => item.name);
  if (
    !Array.isArray(names) ||
    names.length !== PUBLIC_PACKAGE_NAMES.length ||
    names.join('\n') !== PUBLIC_PACKAGE_NAMES.join('\n') ||
    candidate.publishOrder?.join('\n') !== PUBLIC_PACKAGE_NAMES.join('\n')
  ) {
    throw new Error('Candidate must contain the six public packages in dependency order');
  }
  if (!isReleaseVersion(candidate.version)) {
    throw new Error('Candidate release version is invalid');
  }
  const rc = releaseCandidateNumber(candidate.version);
  if ((rc === undefined && tag !== 'latest') || (rc !== undefined && tag !== 'next')) {
    throw new Error('Stable candidates require latest; RC candidates require next');
  }
  for (const item of candidate.packages) {
    const expectedFile = `aeliqo-${packageShortName(item.name)}-${candidate.version}.tgz`;
    if (
      item.version !== candidate.version ||
      item.file !== expectedFile ||
      !/^[0-9a-f]{64}$/.test(item.sha256 ?? '') ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(item.integrity ?? '') ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes <= 0
    ) {
      throw new Error(`Candidate package metadata is invalid for ${item.name}`);
    }
  }
}

export function assertCandidateTarball({
  item,
  candidateVersion,
  manifest,
  paths,
  license,
  notice,
  canonicalLicense,
  canonicalNotice,
}) {
  assertPublicManifest(manifest, item.name, candidateVersion);
  assertTarballPaths(paths, item.name);
  assertExportTargets(manifest, paths, item.name);
  if (!Buffer.isBuffer(license) || !license.equals(canonicalLicense)) {
    throw new Error(`${item.name} packed LICENSE differs from the canonical Apache-2.0 text`);
  }
  if (!Buffer.isBuffer(notice) || !notice.equals(canonicalNotice)) {
    throw new Error(`${item.name} packed NOTICE differs from the canonical attribution`);
  }
}

export function assertTrustedPublishingContext(environment, sourceRevision) {
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== GITHUB_REPOSITORY ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_ACTOR !== GITHUB_OWNER ||
    environment.GITHUB_TRIGGERING_ACTOR !== GITHUB_OWNER ||
    environment.GITHUB_SHA !== sourceRevision
  ) {
    throw new Error('Trusted publication requires the owner-dispatched canonical current-main workflow context');
  }
}

export function assertTagMayAdvance({ name, tag, desiredVersion, currentVersion, versionAlreadyExists }) {
  if (currentVersion === desiredVersion) return;
  if (versionAlreadyExists) throw new Error(`${name}@${desiredVersion} exists but dist-tag ${tag} does not select it`);
  if (currentVersion === undefined) return;
  const desiredRc = releaseCandidateNumber(desiredVersion);
  const currentRc = releaseCandidateNumber(currentVersion);
  if (tag === 'next' && desiredRc !== undefined && currentRc !== undefined && currentRc < desiredRc) return;
  const stable = (value) => /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/u.exec(value)?.slice(1, 4).map(Number);
  const desiredStable = stable(desiredVersion);
  const currentStable = stable(currentVersion);
  if (
    tag === 'latest' &&
    desiredVersion === RELEASE_VERSION &&
    desiredStable !== undefined &&
    currentStable !== undefined
  ) {
    const comparison = desiredStable.findIndex((part, index) => part !== currentStable[index]);
    if (
      (comparison >= 0 && desiredStable[comparison] > currentStable[comparison]) ||
      (comparison < 0 && currentVersion !== desiredVersion)
    )
      return;
  }
  throw new Error(`Refusing to move ${name} dist-tag ${tag} from ${currentVersion} to ${desiredVersion}`);
}

export function assertApprovedRc({ candidate, publication, consumer, version, sourceRevision }) {
  assertCandidateIdentity(candidate, { tag: 'next' });
  if (
    candidate?.schema !== 'aeliqo.release-candidate.v1' ||
    candidate.version !== version ||
    candidate.sourceRevision !== sourceRevision
  ) {
    throw new Error('Approved RC candidate identity does not match the selected predecessor');
  }
  if (
    publication?.schema !== 'aeliqo.npm-publication.v2' ||
    publication.version !== version ||
    publication.sourceRevision !== sourceRevision ||
    publication.tag !== 'next' ||
    publication.mode !== 'trusted-publishing' ||
    typeof publication.completedAt !== 'string'
  ) {
    throw new Error('Approved RC publication record is incomplete or was not created by trusted publishing');
  }
  if (
    consumer?.schema !== 'aeliqo.registry-consumer.v2' ||
    consumer.version !== version ||
    consumer.expectedSourceRevision !== sourceRevision ||
    consumer.provenanceVerified !== true
  ) {
    throw new Error('Approved RC consumer record lacks source-bound provenance verification');
  }
  if (
    publication.packages?.length !== PUBLIC_PACKAGE_NAMES.length ||
    consumer.packages?.length !== PUBLIC_PACKAGE_NAMES.length ||
    new Set(publication.packages.map((item) => item.name)).size !== PUBLIC_PACKAGE_NAMES.length ||
    new Set(consumer.packages.map((item) => item.name)).size !== PUBLIC_PACKAGE_NAMES.length
  ) {
    throw new Error('Approved RC records must contain each public package exactly once');
  }
  for (const item of candidate.packages ?? []) {
    const published = publication.packages?.find((entry) => entry.name === item.name);
    const installed = consumer.packages?.find((entry) => entry.name === item.name);
    if (published?.integrity !== item.integrity || installed?.integrity !== item.integrity) {
      throw new Error(`Approved RC integrity mismatch for ${item.name}`);
    }
  }
}

function decodedStatements(verified) {
  const statements = [];
  for (const attestation of verified?.attestationBundles ?? []) {
    if (attestation?.predicateType !== 'https://slsa.dev/provenance/v1') continue;
    const payload = attestation?.bundle?.dsseEnvelope?.payload;
    if (typeof payload !== 'string') continue;
    try {
      statements.push(JSON.parse(Buffer.from(payload, 'base64').toString('utf8')));
    } catch {
      /* rejected below */
    }
  }
  return statements;
}

export function verifyNpmProvenance(audit, { name, version, integrity, sourceRevision }) {
  const verified = audit?.verified?.find((item) => item.name === name && item.version === version);
  const expectedSubject = packagePurl(name, version);
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity ?? ''))
    throw new Error(`${name}@${version} has malformed expected integrity`);
  const expectedSha512 = Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex');
  for (const statement of decodedStatements(verified)) {
    const workflow = statement?.predicate?.buildDefinition?.externalParameters?.workflow;
    const github = statement?.predicate?.buildDefinition?.internalParameters?.github;
    const dependencies = statement?.predicate?.buildDefinition?.resolvedDependencies;
    const subject = statement?.subject?.find(
      (item) => item.name === expectedSubject && item.digest?.sha512 === expectedSha512,
    );
    const source =
      Array.isArray(dependencies) &&
      dependencies.some(
        (item) =>
          item?.digest?.gitCommit === sourceRevision &&
          item?.uri === `git+https://github.com/${GITHUB_REPOSITORY}@refs/heads/main`,
      );
    if (
      statement?.predicateType === 'https://slsa.dev/provenance/v1' &&
      subject &&
      source &&
      workflow?.repository === `https://github.com/${GITHUB_REPOSITORY}` &&
      workflow?.ref === 'refs/heads/main' &&
      String(workflow?.path ?? '').replace(/^\//, '') === RELEASE_WORKFLOW &&
      github?.event_name === 'workflow_dispatch' &&
      statement?.predicate?.runDetails?.builder?.id === 'https://github.com/actions/runner/github-hosted'
    ) {
      return { name, version, sourceRevision, workflow: RELEASE_WORKFLOW };
    }
  }
  throw new Error(`${name}@${version} lacks canonical source-bound npm provenance`);
}

export function expectedIntegrity(bytes, item) {
  if (bytes.byteLength !== item.bytes)
    throw new Error(`${item.name} tarball byte length differs from the candidate manifest`);
  if (sha256(bytes) !== item.sha256)
    throw new Error(`${item.name} tarball SHA-256 differs from the candidate manifest`);
  const integrity = sha512Integrity(bytes);
  if (integrity !== item.integrity)
    throw new Error(`${item.name} tarball integrity differs from the candidate manifest`);
  return integrity;
}
