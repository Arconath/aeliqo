#!/usr/bin/env bash
set -Eeuo pipefail
root="$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$root"

node <<'NODE'
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aeliqo-site-runner-contract-'));
const relatives = [
  '.github/workflows/quality.yml',
  '.github/workflows/release.yml',
  'scripts/ci/check-runner-contract.sh',
  'scripts/ci/publish-production-image.sh',
];
const requiredRunnerFragments = [
  'RUNNER_ENVIRONMENT:-}" = self-hosted',
  '^r640-quality-([1-2])-[0-9]+-[0-9]+$',
  '^r640-trusted-([1-4])-[0-9]+-[0-9]+$',
  'name=rootless',
  'ci-runner:ci-build-access 660',
  'socket.SO_PEERCRED',
  'socket group is outside the quality user subordinate mapping',
  '/proc/{pid}/uid_map',
  'github.com/moby/buildkit\\ v0\\.33\\.0',
  'buildctl debug info',
  'org\\.mobyproject\\.buildkit\\.worker\\.executor:',
  'org\\.mobyproject\\.buildkit\\.worker\\.snapshotter:',
];

try {
  for (const relative of relatives) {
    const target = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(root, relative), target);
  }
  const originals = Object.fromEntries(relatives.map((relative) => [
    relative,
    fs.readFileSync(path.join(root, relative), 'utf8'),
  ]));
  const mutations = [
    ['.github/workflows/quality.yml', 'pull_request_target:', 'pull_request:'],
    ['.github/workflows/quality.yml', "github.actor == 'hermawan22'", 'true'],
    ['.github/workflows/quality.yml', 'github.event.pull_request.head.repo.full_name == github.repository', 'true'],
    ['.github/workflows/quality.yml', 'group: arconath-r640-quality', 'group: default'],
    ['.github/workflows/quality.yml', "node-version: '24.20.0'", "node-version: '22.23.2'"],
    ['.github/workflows/quality.yml', "go-version: '1.27.0'", "go-version: '1.26.0'"],
    ['.github/workflows/quality.yml', 'package-manager-cache: false', 'package-manager-cache: true'],
    ['.github/workflows/quality.yml', 'pnpm exec playwright install chromium', 'pnpm exec playwright install firefox'],
    ['.github/workflows/quality.yml', 'run: pnpm check', 'run: pnpm typecheck'],
    ['.github/workflows/quality.yml', 'AELIQO_SITE_BUILD_ID: ${{ github.run_id }}-${{ github.run_attempt }}', 'AELIQO_BUILD_ID: unknown'],
    ['.github/workflows/quality.yml', 'test "$(git rev-parse HEAD)" = "$SOURCE_SHA"', 'true'],
    ['.github/workflows/quality.yml', 'git diff --quiet', 'true'],
    ['.github/workflows/quality.yml', 'git diff --cached --quiet', 'true'],
    ['.github/workflows/quality.yml', 'DOCKER_BUILDKIT=1 docker build', 'docker build'],
    ['.github/workflows/release.yml', " && github.triggering_actor == 'hermawan22'", ''],
    ['.github/workflows/release.yml', '--data-urlencode "head_sha=$SOURCE_SHA"', '--data-urlencode "head_sha=unknown"'],
    ['.github/workflows/release.yml', 'curl --fail --silent --show-error --location', 'true'],
    ['.github/workflows/release.yml', 'persist-credentials: false', 'persist-credentials: true'],
    ['scripts/ci/publish-production-image.sh', 'buildctl build', 'docker build'],
    ['scripts/ci/publish-production-image.sh', 'oci-artifact=true', 'oci-artifact=false'],
    ['scripts/ci/publish-production-image.sh', 'imageConfigDigest', 'unverifiedConfigDigest'],
    ['scripts/ci/publish-production-image.sh', 'curl --fail --silent --show-error --location', 'true'],
    ['scripts/ci/check-runner-contract.sh', 'ci-runner:ci-build-access 660', 'root:root 777'],
    ['scripts/ci/check-runner-contract.sh', 'socket.SO_PEERCRED', '0'],
    ['scripts/ci/check-runner-contract.sh', 'socket group is outside the quality user subordinate mapping', 'unchecked subordinate socket group'],
    ['scripts/ci/check-runner-contract.sh', 'buildctl debug info', 'true'],
  ];

  function install(sources) {
    for (const [relative, source] of Object.entries(sources)) {
      fs.writeFileSync(path.join(fixture, relative), source);
    }
  }
  function verify() {
    const runner = fs.readFileSync(path.join(fixture, 'scripts/ci/check-runner-contract.sh'), 'utf8');
    if (requiredRunnerFragments.some((fragment) => !runner.includes(fragment))) {
      return {status: 1, stderr: 'runner runtime assertion missing'};
    }
    return childProcess.spawnSync('bash', ['scripts/ci/check-runner-contract.sh'], {
      cwd: fixture,
      encoding: 'utf8',
    });
  }

  install(originals);
  const valid = verify();
  if (valid.status !== 0) throw new Error(`valid fixture rejected:\n${valid.stderr}`);
  for (const [relative, oldValue, newValue] of mutations) {
    if (!originals[relative].includes(oldValue)) {
      throw new Error(`mutation target missing: ${relative}: ${oldValue}`);
    }
    const changed = {...originals};
    changed[relative] = originals[relative].replaceAll(oldValue, newValue);
    install(changed);
    if (verify().status === 0) throw new Error(`unsafe mutation accepted: ${relative}: ${oldValue}`);
  }
  console.log(`${mutations.length} quality and release mutations rejected`);
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
NODE
