#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"
case "${1:-static}" in
  --runtime=buildkit)
    test "$(id -u)" -ne 0
    test ! -S /var/run/docker.sock
    test -z "${DOCKER_HOST:-}"
    test -z "${CONTAINER_HOST:-}"
    test "${BUILDKIT_HOST:-}" = unix:///run/arconath-buildkit/buildkitd.sock
    test -S "${BUILDKIT_HOST#unix://}"
    buildctl debug workers >/dev/null
    ;;
  static)
    test "$(find .github/workflows -maxdepth 1 -type f -name '*.yml' -print | wc -l | tr -d ' ')" = 2
    ! rg -n 'self-hosted|arconath-jit|r640-trusted' .github/workflows/quality.yml
    rg -F 'group: arconath-jit' .github/workflows/release.yml >/dev/null
    rg -F 'labels: r640-trusted' .github/workflows/release.yml >/dev/null
    rg -F 'github.triggering_actor == '\''hermawan22'\''' .github/workflows/release.yml >/dev/null
    rg -F 'head_sha="$SOURCE_SHA"' .github/workflows/release.yml >/dev/null
    ! rg -n 'kubectl|kubeconfig|KUBECONFIG|secrets\.' .github/workflows
    ;;
  *) exit 2 ;;
esac

