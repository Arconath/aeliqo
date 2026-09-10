#!/usr/bin/env sh
set -eu

image="${1:?usage: check-static-image.sh IMAGE [REVISION]}"
revision="${2:-unknown}"
container="aeliqo-static-$$"
temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/aeliqo-image-check.XXXXXX")"

test "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" = "$revision"

cleanup() {
	docker rm --force "$container" >/dev/null 2>&1 || true
	rm -rf "$temp_dir"
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

# SIGTERM must make readiness fail while the listener remains available for the
# five-second load-balancer drain window. The server must then stop inside the
# 30-second Kubernetes termination grace period.
docker kill --signal TERM "$container" >/dev/null
draining=false
attempt=1
while [ "$attempt" -le 40 ]; do
	status="$(curl --silent --output "$temp_dir/readyz.json" --write-out '%{http_code}' "$base/readyz" || true)"
	if [ "$status" = 503 ] && grep -qx '{"status":"draining"}' "$temp_dir/readyz.json"; then
		draining=true
		break
	fi
	sleep 0.1
	attempt=$((attempt + 1))
done
test "$draining" = true

stopped=false
attempt=1
while [ "$attempt" -le 300 ]; do
	if ! docker container inspect "$container" >/dev/null 2>&1; then
		stopped=true
		break
	fi
	sleep 0.1
	attempt=$((attempt + 1))
done
test "$stopped" = true
