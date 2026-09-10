import {
  PUBLIC_PACKAGE_NAMES, assertExportTargets, assertPublicManifest,
  assertTarballPaths, packagePurl, packageShortName, sha256, sha512Integrity,
} from './candidate-lib.mjs';

export const NPM_OWNER = 'arconath';
export const NPM_ORG = 'aeliqo';
export const GITHUB_REPOSITORY = 'Arconath/aeliqo';
export const GITHUB_OWNER = 'hermawan22';
export const RELEASE_WORKFLOW = '.github/workflows/release-publish.yml';

const RC = /^0\.1\.0-rc\.([1-9]\d*)$/;

export function assertCandidateIdentity(candidate, {bootstrap = false, tag} = {}) {
  const names = candidate?.packages?.map(item => item.name);
  if (!Array.isArray(names) || names.length !== PUBLIC_PACKAGE_NAMES.length
    || names.join('\n') !== PUBLIC_PACKAGE_NAMES.join('\n')
    || candidate.publishOrder?.join('\n') !== PUBLIC_PACKAGE_NAMES.join('\n')) {
    throw new Error('Candidate must contain the six public packages in dependency order');
  }
  if (bootstrap) {
    if (candidate.version !== '0.1.0-rc.1' || tag !== 'next') {
      throw new Error('Owner bootstrap is restricted to exact 0.1.0-rc.1 on the next tag');
    }
  } else if (candidate.version === '0.1.0-rc.1') {
    throw new Error('0.1.0-rc.1 is reserved for the interactive first-publication bootstrap');
  }
  if (!RC.test(candidate.version ?? '') && candidate.version !== '0.1.0') {
    throw new Error('Candidate release version is invalid');
  }
  if ((candidate.version === '0.1.0' && tag !== 'rewrite') || (RC.test(candidate.version) && tag !== 'next')) {
    throw new Error('Stable candidates require rewrite; RC candidates require next');
  }
  for (const item of candidate.packages) {
    const expectedFile = `aeliqo-sdk-${packageShortName(item.name)}-${candidate.version}.tgz`;
    if (item.version !== candidate.version || item.file !== expectedFile
      || !/^[0-9a-f]{64}$/.test(item.sha256 ?? '')
      || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(item.integrity ?? '')
      || !Number.isSafeInteger(item.bytes) || item.bytes <= 0) {
      throw new Error(`Candidate package metadata is invalid for ${item.name}`);
    }
  }
}

export function assertCandidateTarball({item, candidateVersion, manifest, paths, license, notice, canonicalLicense, canonicalNotice}) {
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

export function assertBootstrapAuthority({whoami, membership, tfa, stdinTTY, stdoutTTY, stderrTTY, ci}) {
  if (ci || !stdinTTY || !stdoutTTY || !stderrTTY) throw new Error('Owner bootstrap requires an interactive local terminal outside CI');
  if (whoami !== NPM_OWNER || membership?.[NPM_OWNER] !== 'owner') throw new Error(`Owner bootstrap requires ${NPM_OWNER} to own @${NPM_ORG}`);
  if (tfa?.tfa?.mode !== 'auth-and-writes') throw new Error('Owner bootstrap requires auth-and-writes two-factor authentication');
}

export function assertBootstrapPackageHistory({name, version, identityExists, registryVersions, versionState}) {
  if (!Array.isArray(registryVersions)) throw new Error(`Registry history is unavailable for ${name}`);
  if (identityExists === false && registryVersions.length === 0 && versionState === 'absent') return;
  if (identityExists === true && registryVersions.length === 1 && registryVersions[0] === version && versionState === 'verified-existing') return;
  throw new Error(`Owner bootstrap requires unused package identity ${name} or an exact resumable ${version}`);
}

export function assertTrustedPublishingContext(environment, sourceRevision) {
  if (environment.GITHUB_ACTIONS !== 'true'
    || environment.GITHUB_REPOSITORY !== GITHUB_REPOSITORY
    || environment.GITHUB_EVENT_NAME !== 'workflow_dispatch'
    || environment.GITHUB_REF !== 'refs/heads/main'
    || environment.GITHUB_ACTOR !== GITHUB_OWNER
    || environment.GITHUB_TRIGGERING_ACTOR !== GITHUB_OWNER
    || environment.GITHUB_SHA !== sourceRevision) {
    throw new Error('Trusted publication requires the owner-dispatched canonical current-main workflow context');
  }
}

export function assertTagMayAdvance({name, tag, desiredVersion, currentVersion, versionAlreadyExists}) {
  if (currentVersion === desiredVersion) return;
  if (versionAlreadyExists) throw new Error(`${name}@${desiredVersion} exists but dist-tag ${tag} does not select it`);
  if (currentVersion === undefined) return;
  const desiredRc = RC.exec(desiredVersion);
  const currentRc = RC.exec(currentVersion);
  if (tag === 'next' && desiredRc && currentRc && Number(currentRc[1]) < Number(desiredRc[1])) return;
  throw new Error(`Refusing to move ${name} dist-tag ${tag} from ${currentVersion} to ${desiredVersion}`);
}

export function assertApprovedRc({candidate, publication, consumer, version, sourceRevision}) {
  assertCandidateIdentity(candidate, {tag: 'next'});
  if (candidate?.schema !== 'aeliqo.release-candidate.v1' || candidate.version !== version || candidate.sourceRevision !== sourceRevision) {
    throw new Error('Approved RC candidate identity does not match the selected predecessor');
  }
  if (publication?.schema !== 'aeliqo.npm-publication.v2' || publication.version !== version
    || publication.sourceRevision !== sourceRevision || publication.tag !== 'next'
    || publication.mode !== 'trusted-publishing' || typeof publication.completedAt !== 'string') {
    throw new Error('Approved RC publication record is incomplete or was not created by trusted publishing');
  }
  if (consumer?.schema !== 'aeliqo.registry-consumer.v2' || consumer.version !== version
    || consumer.expectedSourceRevision !== sourceRevision || consumer.provenanceVerified !== true) {
    throw new Error('Approved RC consumer record lacks source-bound provenance verification');
  }
  if (publication.packages?.length !== PUBLIC_PACKAGE_NAMES.length || consumer.packages?.length !== PUBLIC_PACKAGE_NAMES.length
    || new Set(publication.packages.map(item => item.name)).size !== PUBLIC_PACKAGE_NAMES.length
    || new Set(consumer.packages.map(item => item.name)).size !== PUBLIC_PACKAGE_NAMES.length) {
    throw new Error('Approved RC records must contain each public package exactly once');
  }
  for (const item of candidate.packages ?? []) {
    const published = publication.packages?.find(entry => entry.name === item.name);
    const installed = consumer.packages?.find(entry => entry.name === item.name);
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
    try { statements.push(JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))); } catch { /* rejected below */ }
  }
  return statements;
}

export function verifyNpmProvenance(audit, {name, version, integrity, sourceRevision}) {
  const verified = audit?.verified?.find(item => item.name === name && item.version === version);
  const expectedSubject = packagePurl(name, version);
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity ?? '')) throw new Error(`${name}@${version} has malformed expected integrity`);
  const expectedSha512 = Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex');
  for (const statement of decodedStatements(verified)) {
    const workflow = statement?.predicate?.buildDefinition?.externalParameters?.workflow;
    const github = statement?.predicate?.buildDefinition?.internalParameters?.github;
    const dependencies = statement?.predicate?.buildDefinition?.resolvedDependencies;
    const subject = statement?.subject?.find(item => item.name === expectedSubject && item.digest?.sha512 === expectedSha512);
    const source = Array.isArray(dependencies) && dependencies.some(item => item?.digest?.gitCommit === sourceRevision
      && item?.uri === `git+https://github.com/${GITHUB_REPOSITORY}@refs/heads/main`);
    if (statement?.predicateType === 'https://slsa.dev/provenance/v1' && subject && source
      && workflow?.repository === `https://github.com/${GITHUB_REPOSITORY}`
      && workflow?.ref === 'refs/heads/main'
      && String(workflow?.path ?? '').replace(/^\//, '') === RELEASE_WORKFLOW
      && github?.event_name === 'workflow_dispatch'
      && statement?.predicate?.runDetails?.builder?.id === 'https://github.com/actions/runner/github-hosted') {
      return {name, version, sourceRevision, workflow: RELEASE_WORKFLOW};
    }
  }
  throw new Error(`${name}@${version} lacks canonical source-bound npm provenance`);
}

export function expectedIntegrity(bytes, item) {
  if (bytes.byteLength !== item.bytes) throw new Error(`${item.name} tarball byte length differs from the candidate manifest`);
  if (sha256(bytes) !== item.sha256) throw new Error(`${item.name} tarball SHA-256 differs from the candidate manifest`);
  const integrity = sha512Integrity(bytes);
  if (integrity !== item.integrity) throw new Error(`${item.name} tarball integrity differs from the candidate manifest`);
  return integrity;
}
