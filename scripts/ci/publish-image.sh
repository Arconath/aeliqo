#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"
: "${GH_TOKEN:?}" "${GH_ACTOR:?}" "${SOURCE_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${RUNNER_TEMP:?}"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
tag="${SOURCE_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
image=ghcr.io/arconath/aeliqo-web
created_docker_config=false
if [[ -z "${DOCKER_CONFIG:-}" ]]; then
  DOCKER_CONFIG="$(mktemp -d "$RUNNER_TEMP/registry.XXXXXX")"
  created_docker_config=true
else
  mkdir -p "$DOCKER_CONFIG"
fi
export DOCKER_CONFIG
trivy_dir="$(mktemp -d "$RUNNER_TEMP/trivy.XXXXXX")"
if [[ "$created_docker_config" == true ]]; then
  trap 'rm -rf "$DOCKER_CONFIG" "$trivy_dir"' EXIT
else
  trap 'rm -rf "$trivy_dir"' EXIT
fi
python3 - <<'PY'
import base64, json, os
from pathlib import Path
value = base64.b64encode((os.environ['GH_ACTOR'] + ':' + os.environ['GH_TOKEN']).encode()).decode()
Path(os.environ['DOCKER_CONFIG'], 'config.json').write_text(json.dumps({'auths': {'ghcr.io': {'auth': value}}}))
PY
out=out/ci-release
mkdir -p "$out"
docker buildx build \
  --file Dockerfile \
  --build-arg "SOURCE_REVISION=$SOURCE_SHA" \
  --label "org.opencontainers.image.revision=$SOURCE_SHA" \
  --label org.opencontainers.image.source=https://github.com/Arconath/aeliqo \
  --provenance=mode=max \
  --tag "$image:$tag" \
  --push \
  --metadata-file "$out/web-build.json" \
  .
digest="$(jq -er '."containerimage.digest" | select(test("^sha256:[0-9a-f]{64}$"))' "$out/web-build.json")"
jq -n --arg image "$image" --arg tag "$tag" --arg digest "$digest" --arg revision "$SOURCE_SHA" \
  '{schemaVersion:1,image:$image,tag:$tag,digest:$digest,revision:$revision}' > "$out/image.json"
curl --fail --silent --show-error --location https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz -o "$trivy_dir/trivy.tar.gz"
echo "2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a  $trivy_dir/trivy.tar.gz" | sha256sum -c -
tar -xzf "$trivy_dir/trivy.tar.gz" -C "$trivy_dir" trivy
export TRIVY_USERNAME="$GH_ACTOR" TRIVY_PASSWORD="$GH_TOKEN" TRIVY_CACHE_DIR="$RUNNER_TEMP/trivy-cache"
mkdir -p "$TRIVY_CACHE_DIR"
"$trivy_dir/trivy" image --scanners vuln --format cyclonedx --output "$out/web-sbom.cdx.json" --severity HIGH,CRITICAL --exit-code 1 "$image@$digest"
