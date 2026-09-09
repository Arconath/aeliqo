#!/usr/bin/env sh
set -eu

image="${1:?usage: check-static-image.sh IMAGE [REVISION]}"
revision="${2:-unknown}"
container="aeliqo-static-$$"

test "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" = "$revision"

cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --detach --rm --name "$container" -p 127.0.0.1::8080 "$image" >/dev/null
port="$(docker port "$container" 8080/tcp | sed 's/.*://')"
base="http://127.0.0.1:$port"

attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent "$base/readyz" | grep -qx '{"status":"ready"}'; then
    break
  fi
  if [ "$attempt" = 30 ]; then
    echo "static image never became ready" >&2
    exit 1
  fi
  sleep 1
  attempt=$((attempt + 1))
done

curl --fail --silent "$base/healthz" | grep -qx '{"status":"ok"}'
curl --fail --silent "$base/version" | grep -Fq '"revision":"'"$revision"'"'

headers="$(curl --fail --silent --head "$base/")"
printf '%s\n' "$headers" | grep -qi '^cache-control: no-cache'
printf '%s\n' "$headers" | grep -qi "^content-security-policy: default-src 'self'"
printf '%s\n' "$headers" | grep -qi '^x-content-type-options: nosniff'

asset="$(curl --fail --silent "$base/" | grep -Eo '/assets/[^"? ]+\.js' | head -n 1)"
test -n "$asset"
curl --fail --silent --head "$base$asset" | grep -qi '^cache-control: public, max-age=31536000, immutable'

status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/not-a-route")"
test "$status" = 404
