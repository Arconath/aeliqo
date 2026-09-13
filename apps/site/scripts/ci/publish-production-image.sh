#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
cd "$(git rev-parse --show-toplevel)/apps/site"

: "${GH_TOKEN:?}" "${GH_ACTOR:?}" "${GH_TRIGGERING_ACTOR:?}" "${GH_REPO:?}"
: "${SOURCE_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${RUNNER_TEMP:?}"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[1-9][0-9]*$ ]]
[[ "$GITHUB_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]]
test "$GH_REPO" = "Arconath/aeliqo"
test "$GH_ACTOR" = "hermawan22"
test "$GH_TRIGGERING_ACTOR" = "hermawan22"
test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
branch_sha="$(curl --fail --silent --show-error --location \
	--header "Authorization: Bearer $GH_TOKEN" \
	--header 'Accept: application/vnd.github+json' \
	--header 'X-GitHub-Api-Version: 2022-11-28' \
	"https://api.github.com/repos/$GH_REPO/branches/main" | \
	jq -er '.commit.sha | select(test("^[0-9a-f]{40}$"))')"
test "$branch_sha" = "$SOURCE_SHA"
git diff --quiet
git diff --cached --quiet

node scripts/verify-inputs.mjs >/dev/null
sdk_revision="$(jq -er '.sourceRevision | select(test("^[0-9a-f]{40}$"))' vendor/packages/manifest.json)"
sdk_version="$(jq -er '.version | select(test("^0\\.1\\.0-rc\\.[1-9][0-9]*$"))' vendor/packages/manifest.json)"

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

trap 'rm -rf "$docker_config" "$trivy_dir"' EXIT

# The tag includes the immutable source, workflow run, and run attempt. GitHub
# never reuses a run attempt, so this build cannot overwrite a prior execution.
builder_id="https://github.com/$GH_REPO/actions/runs/$GITHUB_RUN_ID/attempts/$GITHUB_RUN_ATTEMPT"
builder_name="aeliqo-web-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
docker buildx create --name "$builder_name" --driver docker-container --use >/dev/null
trap 'docker buildx rm --force "$builder_name" >/dev/null 2>&1 || true; rm -rf "$docker_config" "$trivy_dir"' EXIT
docker buildx build \
	--platform linux/amd64 \
	--build-arg "SOURCE_REVISION=$SOURCE_SHA" \
	--build-arg "SDK_SOURCE_REVISION=$sdk_revision" \
	--build-arg "SDK_VERSION=$sdk_version" \
	--label "org.opencontainers.image.revision=$SOURCE_SHA" \
	--label "org.opencontainers.image.source=https://github.com/$GH_REPO" \
	--label "com.aeliqo.sdk.revision=$sdk_revision" \
	--label "com.aeliqo.sdk.version=$sdk_version" \
	--attest "type=provenance,mode=max,builder-id=$builder_id" \
	--output "type=image,name=$reference,push=true,oci-mediatypes=true,oci-artifact=true" \
	--metadata-file "$output/build-metadata.json" \
	--file Dockerfile \
	..

digest="$(jq -er '."containerimage.digest" | select(test("^sha256:[0-9a-f]{64}$"))' "$output/build-metadata.json")"
jq -e --arg digest "$digest" \
	'."containerimage.descriptor".digest == $digest' \
	"$output/build-metadata.json" >/dev/null

python3 scripts/ci/verify-buildkit-provenance.py \
	--repository "$image" \
	--index-digest "$digest" \
	--source "$SOURCE_SHA" \
	--sdk-revision "$sdk_revision" \
	--sdk-version "$sdk_version" \
	--builder-id "$builder_id" \
	--statement-output "$output/provenance.intoto.json" \
	--summary-output "$output/provenance-summary.json"
jq -e \
	'.imageConfigDigest | strings | test("^sha256:[0-9a-f]{64}$")' \
	"$output/provenance-summary.json" >/dev/null
subject_digest="$(jq -er '.subjectDigest | select(test("^sha256:[0-9a-f]{64}$"))' "$output/provenance-summary.json")"
statement_digest="$(jq -er '.statementDigest | select(test("^sha256:[0-9a-f]{64}$"))' "$output/provenance-summary.json")"
jq -n \
	--arg image "$image" \
	--arg tag "$tag" \
	--arg digest "$digest" \
	--arg revision "$SOURCE_SHA" \
	--arg sdkRevision "$sdk_revision" \
	--arg sdkVersion "$sdk_version" \
	--arg builderId "$builder_id" \
	--arg subjectDigest "$subject_digest" \
	--arg statementDigest "$statement_digest" \
	'{schemaVersion:2,image:$image,tag:$tag,digest:$digest,siteRevision:$revision,sdkRevision:$sdkRevision,sdkVersion:$sdkVersion,reference:($image+"@"+$digest),builderId:$builderId,provenance:{format:"https://slsa.dev/provenance/v1",storage:"attached OCI attestation",verifiedFromRegistry:true,subjectDigest:$subjectDigest,statementDigest:$statementDigest}}' \
	> "$output/image.json"

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

(
	cd "$output"
	sha256sum \
		build-metadata.json \
		image.json \
		provenance-summary.json \
		provenance.intoto.json \
		sbom.cdx.json \
		trivy-high-critical.json \
		> SHA256SUMS
)
