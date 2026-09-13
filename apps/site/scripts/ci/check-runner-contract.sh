#!/usr/bin/env bash
set -Eeuo pipefail
root="$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$root"

runtime_contract() {
  local purpose="$1"
  local runner_slot runner_temp workspace worker_details buildctl_version buildkit_info socket_identity security_options
  test "$(id -u)" -ne 0
  test "${GITHUB_ACTIONS:-}" = true
  test "${RUNNER_ENVIRONMENT:-}" = self-hosted
  test ! -S /var/run/docker.sock
  test -z "${CONTAINER_HOST:-}"
  test "${GITHUB_REPOSITORY:-}" = Arconath/aeliqo-site
  test "${GITHUB_ACTOR:-}" = hermawan22
  test "${GITHUB_TRIGGERING_ACTOR:-}" = hermawan22
  test "$(git rev-parse HEAD)" = "${SOURCE_SHA:-}"

  case "$purpose" in
    quality)
      [[ "${RUNNER_NAME:-}" =~ ^r640-quality-([1-2])-[0-9]+-[0-9]+$ ]]
      runner_slot="${BASH_REMATCH[1]}"
      test "$(id -un)" = "ci-quality-$runner_slot"
      runner_temp="$(realpath -m -- "${RUNNER_TEMP:?}")"
      workspace="$(realpath -m -- "${GITHUB_WORKSPACE:?}")"
      [[ "$runner_temp" == "/srv/hdd/quality/jobs/$runner_slot/"* ]]
      [[ "$workspace" == "/srv/hdd/quality/jobs/$runner_slot/"* ]]
      test -z "${BUILDKIT_HOST:-}"
      test "${DOCKER_HOST:-}" = "unix:///run/arconath-quality/$runner_slot/docker.sock"
      test -S "${DOCKER_HOST#unix://}"
      python3 - "${DOCKER_HOST#unix://}" <<'PY'
import os
import pathlib
import pwd
import stat
import sys

socket_path = pathlib.Path(sys.argv[1])
socket_stat = socket_path.stat()
if not stat.S_ISSOCK(socket_stat.st_mode):
    raise SystemExit("quality Docker endpoint is not a Unix socket")
if socket_stat.st_uid != os.getuid():
    raise SystemExit("quality Docker socket is not owned by the isolated quality user")
if stat.S_IMODE(socket_stat.st_mode) != 0o1660:
    raise SystemExit("quality Docker socket permissions differ from the reviewed rootless endpoint")
username = pwd.getpwuid(os.getuid()).pw_name
record = next(
    (line for line in pathlib.Path("/etc/subgid").read_text().splitlines()
     if line.startswith(f"{username}:")),
    None,
)
if record is None:
    raise SystemExit("quality user has no subordinate group mapping")
_, start_text, count_text = record.split(":")
start, count = int(start_text), int(count_text)
if not start <= socket_stat.st_gid < start + count:
    raise SystemExit("socket group is outside the quality user subordinate mapping")
print(f"Rootless quality socket uid={socket_stat.st_uid} subordinate-gid={socket_stat.st_gid} mode=1660")
PY
      security_options="$(docker info --format '{{json .SecurityOptions}}')"
      jq -e 'index("name=rootless") != null' <<<"$security_options" >/dev/null
      case "${GITHUB_EVENT_NAME:-}" in
        pull_request_target)
          test "${PR_HEAD_REPOSITORY:-}" = Arconath/aeliqo-site
          test "${PR_BASE_REPOSITORY:-}" = Arconath/aeliqo-site
          test "${PR_BASE_REF:-}" = "${DEFAULT_BRANCH:-}"
          ;;
        push)
          test "${GITHUB_REF:-}" = "refs/heads/${DEFAULT_BRANCH:-}"
          test "${SOURCE_SHA:-}" = "${GITHUB_SHA:-}"
          ;;
        *) return 1 ;;
      esac
      ;;
    release)
      [[ "${RUNNER_NAME:-}" =~ ^r640-trusted-([1-4])-[0-9]+-[0-9]+$ ]]
      runner_slot="${BASH_REMATCH[1]}"
      test "$(id -un)" = "ci-runner-$runner_slot"
      test -d "${RUNNER_TEMP:?}"
      test -d "${GITHUB_WORKSPACE:?}"
      runner_temp="$(realpath "${RUNNER_TEMP:?}")"
      workspace="$(realpath "${GITHUB_WORKSPACE:?}")"
      [[ "$runner_temp" == "/srv/hdd/jobs/$runner_slot/"* ]]
      [[ "$workspace" == "/srv/hdd/jobs/$runner_slot/"* ]]
      test -z "${DOCKER_HOST:-}"
      test "${BUILDKIT_HOST:-}" = unix:///run/arconath-buildkit/buildkitd.sock
      test -S "${BUILDKIT_HOST#unix://}"
      socket_identity="$(stat -Lc '%U:%G %a' "${BUILDKIT_HOST#unix://}")"
      test "$socket_identity" = 'ci-runner:ci-build-access 660'
      python3 - "${BUILDKIT_HOST#unix://}" <<'PY'
import pwd
import socket
import struct
import sys

path = sys.argv[1]
client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
client.settimeout(5)
client.connect(path)
pid, uid, _ = struct.unpack("3i", client.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
client.close()
if pwd.getpwuid(uid).pw_name != "ci-runner":
    raise SystemExit("BuildKit socket peer is not the unprivileged ci-runner identity")
mapping = open(f"/proc/{pid}/uid_map", encoding="utf-8").read().splitlines()
if not mapping:
    raise SystemExit("BuildKit socket peer has no readable user-namespace map")
inside, outside, length = (int(value) for value in mapping[0].split())
if inside != 0 or outside == 0 or length < 1:
    raise SystemExit("BuildKit socket peer is not in the reviewed rootless user namespace")
print(f"BuildKit socket peer pid={pid} user=ci-runner uid_map={inside}:{outside}:{length}")
PY
      buildctl_version="$(buildctl --version)"
      [[ "$buildctl_version" =~ ^buildctl\ github.com/moby/buildkit\ v0\.33\.0\  ]]
      buildkit_info="$(buildctl debug info)"
      grep -Eq '^BuildKit:[[:space:]]+github\.com/moby/buildkit[[:space:]]+v0\.33\.0([[:space:]]|$)' <<<"$buildkit_info"
      worker_details="$(buildctl debug workers -v)"
      test "$(grep -c '^ID:' <<<"$worker_details")" -eq 1
      grep -Eq 'org\.mobyproject\.buildkit\.worker\.executor:[[:space:]]*oci' <<<"$worker_details"
      grep -Eq 'org\.mobyproject\.buildkit\.worker\.snapshotter:[[:space:]]*(overlayfs|fuse-overlayfs|native)' <<<"$worker_details"
      test "${GITHUB_EVENT_NAME:-}" = workflow_dispatch
      test "${GITHUB_REF:-}" = refs/heads/main
      test "${SOURCE_SHA:-}" = "${GITHUB_SHA:-}"
      ;;
    *) return 2 ;;
  esac
}

case "${1:-static}" in
  --runtime=quality) runtime_contract quality; exit 0 ;;
  --runtime=release) runtime_contract release; exit 0 ;;
  static) ;;
  *) echo 'usage: check-runner-contract.sh [static|--runtime=quality|--runtime=release]' >&2; exit 2 ;;
esac

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const workflowDir = '.github/workflows';
const paths = fs.readdirSync(workflowDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => path.posix.join(workflowDir, name))
  .sort();
const expected = ['.github/workflows/quality.yml', '.github/workflows/release.yml'];
if (JSON.stringify(paths) !== JSON.stringify(expected)) {
  throw new Error(`expected exactly ${expected.join(', ')}`);
}

const quality = fs.readFileSync(expected[0], 'utf8');
const release = fs.readFileSync(expected[1], 'utf8');
const publisher = fs.readFileSync('scripts/ci/publish-production-image.sh', 'utf8');
const runnerContract = fs.readFileSync('scripts/ci/check-runner-contract.sh', 'utf8');

function requireAll(label, source, fragments) {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) throw new Error(`${label} is missing ${fragment}`);
  }
}
function forbid(label, source, pattern) {
  if (pattern.test(source)) throw new Error(`${label} contains forbidden ${pattern}`);
}
function validateActions(label, source) {
  const actions = [...source.matchAll(/^\s*- uses:\s*(\S+)\s*$/gm)].map((match) => match[1]);
  if (actions.length === 0) throw new Error(`${label} has no pinned actions`);
  for (const action of actions) {
    if (!/^[^@]+@[0-9a-f]{40}$/.test(action)) throw new Error(`${label} action is not SHA pinned: ${action}`);
  }
  const checkouts = [...source.matchAll(/^\s*- uses:\s*actions\/checkout@[0-9a-f]{40}\s*$/gm)];
  const persisted = [...source.matchAll(/^\s*persist-credentials:\s*false\s*$/gm)];
  if (checkouts.length !== persisted.length) throw new Error(`${label} checkout credentials may persist`);
}

for (const [label, source] of [['quality', quality], ['release', release]]) {
  forbid(label, source, /secrets\./);
  forbid(label, source, /continue-on-error:\s*true/);
  requireAll(label, source, [
    'contents: read',
  ]);
  validateActions(label, source);
}

requireAll('quality', quality, [
  'group: arconath-r640-quality',
  'labels: r640-quality',
  'pull_request_target:',
  'branches: [main]',
  "github.repository == 'Arconath/aeliqo-site'",
  "github.actor == 'hermawan22'",
  "github.triggering_actor == 'hermawan22'",
  'github.event.pull_request.head.repo.full_name == github.repository',
  'github.event.pull_request.base.repo.full_name == github.repository',
  'github.event.pull_request.base.ref == github.event.repository.default_branch',
  "github.event_name == 'push'",
  "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  'SOURCE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}',
  'AELIQO_SOURCE_COMMIT: ${{ github.event.pull_request.head.sha || github.sha }}',
  'AELIQO_SITE_BUILD_ID: ${{ github.run_id }}-${{ github.run_attempt }}',
  'ref: ${{ github.event.pull_request.head.sha || github.sha }}',
  'check-runner-contract.sh --runtime=quality',
  'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444',
  "node-version: '24.20.0'",
  'package-manager-cache: false',
  'actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16',
  "go-version: '1.27.0'",
  'cache: false',
  'corepack prepare pnpm@11.24.0 --activate',
  'pnpm install --frozen-lockfile',
  'pnpm exec playwright install chromium',
  'run: pnpm check',
  'test "$(git rev-parse HEAD)" = "$SOURCE_SHA"',
  'git diff --quiet',
  'git diff --cached --quiet',
  'DOCKER_BUILDKIT=1 docker build',
  'check-static-image.sh',
]);
forbid('quality', quality, /BUILDKIT_HOST/);
forbid('quality', quality, /^\s{2}pull_request:\s*$/m);
forbid('quality', quality, /packages:\s*write/);
forbid('quality', quality, /id-token:\s*write/);

requireAll('release', release, [
  'group: arconath-jit',
  'labels: r640-trusted',
  'workflow_dispatch:',
  'group: r640-heavy-build',
  'cancel-in-progress: false',
  "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && github.actor == 'hermawan22' && github.triggering_actor == 'hermawan22'",
  'actions: read',
  'packages: write',
  'test "$EVENT" = "workflow_dispatch"',
  'test "$REF" = "refs/heads/main"',
  'test "$ACTOR" = "hermawan22"',
  'test "$TRIGGERING_ACTOR" = "hermawan22"',
  'curl --fail --silent --show-error --location',
  'https://api.github.com/repos/$GH_REPO/branches/main',
  'actions/workflows/quality.yml/runs',
  '--data-urlencode "head_sha=$SOURCE_SHA"',
  '--data-urlencode \'branch=main\'',
  '--data-urlencode \'event=push\'',
  '--data-urlencode \'status=success\'',
  '.head_sha == $sha',
  '.head_branch == "main"',
  '.event == "push"',
  '.conclusion == "success"',
  'ref: ${{ github.sha }}',
  'check-runner-contract.sh --runtime=release',
]);
forbid('release', release, /^\s{2}(pull_request|pull_request_target|push):/m);
forbid('release', release, /\bgh\s+api/);

requireAll('publisher', publisher, [
  'buildctl build',
  'vcs:source',
  'vcs:revision',
  'attest:provenance=mode=max',
  'type=image',
  'oci-artifact=true',
  'verify-buildkit-provenance.py',
  'imageConfigDigest',
  'verifiedFromRegistry:true',
  'curl --fail --silent --show-error --location',
  'https://api.github.com/repos/$GH_REPO/branches/main',
]);
forbid('publisher', publisher, /\bdocker\s+(build|buildx|pull|run|login)/);
forbid('publisher', publisher, /\bgh\s+api/);
forbid('publisher', publisher, /containerimage\.config\.digest/);
requireAll('runner runtime', runnerContract, [
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
]);
if (fs.existsSync('Dockerfile.ci')) throw new Error('Dockerfile.ci must not remain in the private site repository');

console.log('Direct R640 quality and trusted R640 release contracts passed');
NODE
