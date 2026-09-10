#!/usr/bin/env sh
set -eu

target="${1:?usage: static-smoke-negative-harness.sh SCRIPT}"
revision="421deab7881fdda54474e64e9556cb7edc7392361d251987d00fd4f5d85b49e6"
work="$(mktemp -d "${TMPDIR:-/tmp}/aeliqo-static-smoke-matrix.XXXXXX")"
trap 'rm -rf "$work"' EXIT INT TERM

run_case() {
	name="$1"
	mode="$2"
	output="$work/$name.output"
	calls="$work/$name.calls"
	: > "$calls"
	set +e
	AELIQO_MOCK_MODE="$mode" AELIQO_MOCK_LOG="$calls" AELIQO_MOCK_REVISION="$revision" \
		sh -c '
			set -eu
			MOCK_KILLED=false

			docker() {
				case "$1" in
					image)
						printf "%s\n" "$AELIQO_MOCK_REVISION"
						;;
					run|rm)
						return 0
						;;
					port)
						printf "127.0.0.1:43127\n"
						;;
					kill)
						MOCK_KILLED=true
						;;
					container)
						if [ "$MOCK_KILLED" = true ]; then return 1; fi
						return 0
						;;
					*)
						echo "unexpected docker call: $*" >&2
						return 2
						;;
				esac
			}

			curl() {
				head=false
				output_file=
				write_out=
				url=
				while [ "$#" -gt 0 ]; do
					arg="$1"
					shift
					case "$arg" in
						--head) head=true ;;
						--output) output_file="$1"; shift ;;
						--write-out) write_out="$1"; shift ;;
						http://*) url="$arg" ;;
					esac
				done

				if [ "$url" = "http://127.0.0.1:43127/readyz" ]; then
					if [ -n "$write_out" ]; then
						printf "%s\n" "{\"status\":\"draining\"}" > "$output_file"
						printf "503"
					else
						printf "%s\n" "{\"status\":\"ready\"}"
					fi
					return 0
				fi
				if [ "$url" = "http://127.0.0.1:43127/healthz" ]; then
					printf "%s\n" "{\"status\":\"ok\"}"
					return 0
				fi
				if [ "$url" = "http://127.0.0.1:43127/version" ]; then
					printf "{\"revision\":\"%s\"}\n" "$AELIQO_MOCK_REVISION"
					return 0
				fi
				if [ "$url" = "http://127.0.0.1:43127/" ] && [ "$head" = true ]; then
					printf "%s\n" "HTTP/1.1 200 OK" "cache-control: no-cache" "content-security-policy: default-src '\''self'\''" "x-content-type-options: nosniff"
					return 0
				fi
				if [ "$url" = "http://127.0.0.1:43127/" ]; then
					case "$AELIQO_MOCK_MODE" in
						empty) ;;
						*) printf "%s\n" "/assets/site-a1b2c3d4.js" "/assets/site-b2c3d4e5.css" ;;
					esac
					return 0
				fi
				case "$url" in
					http://127.0.0.1:43127/assets/*)
						printf "%s\n" "$url" >> "$AELIQO_MOCK_LOG"
						if [ "$AELIQO_MOCK_MODE" = fail ]; then return 1; fi
						printf "%s\n" "HTTP/1.1 200 OK" "cache-control: public, max-age=31536000, immutable"
						;;
					http://127.0.0.1:43127/not-a-route)
						printf "404"
						;;
					*)
						echo "unexpected curl URL: $url" >&2
						return 2
						;;
				esac
			}

			sleep() { :; }
			. "$1" mock-image "$AELIQO_MOCK_REVISION"
		' sh "$target" > "$output" 2>&1
	rc=$?
	set -e
	printf '%s mode=%s exit=%s\n' "$name" "$mode" "$rc"
	cat "$output"
	printf '%s calls:\n' "$name"
	cat "$calls"

	case "$name" in
		empty)
		[ "$rc" -eq 1 ]
		;;
		multi)
		[ "$rc" -eq 0 ]
		grep -Fxq 'http://127.0.0.1:43127/assets/site-a1b2c3d4.js' "$calls"
		grep -Fxq 'http://127.0.0.1:43127/assets/site-b2c3d4e5.css' "$calls"
		[ "$(wc -l < "$calls" | tr -d ' ')" -eq 2 ]
		;;
		failed-curl)
		[ "$rc" -eq 1 ]
		;;
	esac
}

run_case empty empty
run_case multi multi
run_case failed-curl fail
printf '%s\n' 'negative smoke matrix passed: empty assets reject, every multi-asset URL is checked, and curl failure rejects'
