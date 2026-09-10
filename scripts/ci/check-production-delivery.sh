#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

case "${1:-static}" in
	--runtime=hosted)
		test "$(id -u)" -ne 0
		command -v docker >/dev/null
		command -v gh >/dev/null
		docker version >/dev/null
		docker buildx version >/dev/null
		;;
	static)
		test -f .github/workflows/quality.yml
		test -f .github/workflows/release.yml
		test -x scripts/ci/check-static-image.sh
		test -x scripts/ci/publish-production-image.sh

		! grep -En 'self-hosted|arconath-jit|r640-trusted' .github/workflows/*.yml
		! grep -En 'kubectl|kubeconfig|KUBECONFIG|secrets\.' .github/workflows/quality.yml .github/workflows/release.yml
		grep -F "branches: [main]" .github/workflows/quality.yml >/dev/null
		grep -F "node-version: '24.20.0'" .github/workflows/quality.yml >/dev/null
		grep -F "pnpm@11.24.0" .github/workflows/quality.yml >/dev/null
		grep -F 'FROM node:24.20.0-alpine@sha256:' Dockerfile >/dev/null
		grep -F 'corepack prepare pnpm@11.24.0 --activate' Dockerfile >/dev/null
		grep -F 'go test ./deploy/server.go ./deploy/server_test.go' .github/workflows/quality.yml >/dev/null
		grep -F 'pnpm check' .github/workflows/quality.yml >/dev/null
		grep -F 'scripts/ci/check-static-image.sh' .github/workflows/quality.yml >/dev/null

		grep -F 'github.triggering_actor == '\''hermawan22'\''' .github/workflows/release.yml >/dev/null
		# The dollar-prefixed strings below are intentional workflow/script literals.
		# shellcheck disable=SC2016
		grep -F 'head_sha="$SOURCE_SHA"' .github/workflows/release.yml >/dev/null
		grep -F 'actions/workflows/quality.yml/runs' .github/workflows/release.yml >/dev/null
		grep -F 'scripts/ci/publish-production-image.sh' .github/workflows/release.yml >/dev/null

		# shellcheck disable=SC2016
		grep -F 'repos/$GH_REPO/branches/main' scripts/ci/publish-production-image.sh >/dev/null
		# shellcheck disable=SC2016
		grep -F '" = "$SOURCE_SHA"' scripts/ci/publish-production-image.sh >/dev/null
		grep -F -- '--provenance=mode=max' scripts/ci/publish-production-image.sh >/dev/null
		grep -F -- '--severity HIGH,CRITICAL' scripts/ci/publish-production-image.sh >/dev/null
		grep -F 'ghcr.io/arconath/aeliqo-web' scripts/ci/publish-production-image.sh >/dev/null
		;;
	*)
		exit 2
		;;
esac
