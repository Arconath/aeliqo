#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
cd "$(git rev-parse --show-toplevel)"

: "${GH_TOKEN:?}" "${GH_ACTOR:?}" "${GH_TRIGGERING_ACTOR:?}" "${GH_REPO:?}"
: "${SOURCE_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${RUNNER_TEMP:?}"

[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
test "$GH_REPO" = "Arconath/aeliqo"
test "$GH_ACTOR" = "hermawan22"
test "$GH_TRIGGERING_ACTOR" = "hermawan22"
test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
test "$(gh api "repos/$GH_REPO/branches/main" --jq '.commit.sha')" = "$SOURCE_SHA"
git diff --quiet
git diff --cached --quiet

image="ghcr.io/arconath/aeliqo-web"
tag="${SOURCE_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
reference="$image:$tag"
output="artifacts/production-image"
mkdir -p "$output"

docker_config="$(mktemp -d "$RUNNER_TEMP/aeliqo-registry.XXXXXX")"
trivy_dir="$(mktemp -d "$RUNNER_TEMP/aeliqo-trivy.XXXXXX")"
export DOCKER_CONFIG="$docker_config"

python3 - <<'PY'
import base64
import json
import os
from pathlib import Path

credential = base64.b64encode(f"{os.environ['GH_ACTOR']}:{os.environ['GH_TOKEN']}".encode()).decode()
Path(os.environ["DOCKER_CONFIG"], "config.json").write_text(
    json.dumps({"auths": {"ghcr.io": {"auth": credential}}})
)
PY

builder="$(docker buildx create --driver docker-container --use)"
trap 'docker buildx rm "$builder" >/dev/null 2>&1 || true; rm -rf "$docker_config" "$trivy_dir"' EXIT
docker buildx inspect --bootstrap >/dev/null

if docker buildx imagetools inspect "$reference" >/dev/null 2>&1; then
	echo "Refusing to overwrite existing immutable image tag: $reference" >&2
	exit 1
fi

export BUILDX_METADATA_PROVENANCE=max
docker buildx build \
	--file Dockerfile \
	--build-arg "SOURCE_REVISION=$SOURCE_SHA" \
	--label "org.opencontainers.image.revision=$SOURCE_SHA" \
	--label "org.opencontainers.image.source=https://github.com/$GH_REPO" \
	--platform linux/amd64 \
	--provenance=mode=max \
	--tag "$reference" \
	--push \
	--metadata-file "$output/build-metadata.json" \
	.

digest="$(jq -er '."containerimage.digest" | select(test("^sha256:[0-9a-f]{64}$"))' "$output/build-metadata.json")"
jq -e '."buildx.build.provenance" != null' "$output/build-metadata.json" >/dev/null
jq '."buildx.build.provenance"' "$output/build-metadata.json" > "$output/provenance.json"
jq -n \
	--arg image "$image" \
	--arg tag "$tag" \
	--arg digest "$digest" \
	--arg revision "$SOURCE_SHA" \
	'{schemaVersion:1,image:$image,tag:$tag,digest:$digest,revision:$revision,reference:($image+"@"+$digest)}' \
	> "$output/image.json"

docker pull "$image@$digest" >/dev/null
scripts/ci/check-static-image.sh "$image@$digest" "$SOURCE_SHA"

curl --fail --silent --show-error --location \
	"https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz" \
	--output "$trivy_dir/trivy.tar.gz"
echo "2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a  $trivy_dir/trivy.tar.gz" | sha256sum -c -
tar -xzf "$trivy_dir/trivy.tar.gz" -C "$trivy_dir" trivy

export TRIVY_USERNAME="$GH_ACTOR"
export TRIVY_PASSWORD="$GH_TOKEN"
export TRIVY_CACHE_DIR="$RUNNER_TEMP/aeliqo-trivy-cache"
mkdir -p "$TRIVY_CACHE_DIR"
"$trivy_dir/trivy" image \
	--scanners vuln \
	--format cyclonedx \
	--output "$output/sbom.cdx.json" \
	"$image@$digest"
"$trivy_dir/trivy" image \
	--scanners vuln \
	--format json \
	--output "$output/trivy-high-critical.json" \
	--severity HIGH,CRITICAL \
	--exit-code 1 \
	"$image@$digest"

sha256sum \
	"$output/build-metadata.json" \
	"$output/image.json" \
	"$output/provenance.json" \
	"$output/sbom.cdx.json" \
	"$output/trivy-high-critical.json" \
	> "$output/SHA256SUMS"
