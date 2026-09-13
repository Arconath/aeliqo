#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

test "$(node -p "require('./package.json').private")" = true
test "$(node -p "require('./package.json').name")" = '@aeliqo/site'
test "$(node -p "require('./package.json').packageManager")" = 'pnpm@11.24.0'

if git grep -nE 'apps/site|\.\./\.\./(packages|harness)|pnpm --filter @aeliqo/site|build:site' -- \
  ':!README.md' ':!PROVENANCE.md' ':!vendor/**' ':!scripts/ci/check-repository-boundary.sh'; then
  echo 'Cross-checkout or former-monorepo coupling detected.' >&2
  exit 1
fi

if git grep -nE 'kubectl|kubeconfig' -- '.github/workflows/*'; then
  echo 'Cluster mutation authority detected in the site repository.' >&2
  exit 1
fi

if git grep -nE '(secrets\.|id-token: write|packages: write)' -- '.github/workflows/quality.yml'; then
  echo 'Pull-request quality workflow may not receive publication or production authority.' >&2
  exit 1
fi

if git grep -nE 'runs-on:[[:space:]]*ubuntu-|ubuntu-latest' -- '.github/workflows/*'; then
  echo 'Private site CI may not consume unavailable GitHub-hosted runners.' >&2
  exit 1
fi

test "$(git grep -h 'group: arconath-r640-quality' -- '.github/workflows/*' | wc -l | tr -d ' ')" = 1
test "$(git grep -h 'labels: r640-quality' -- '.github/workflows/*' | wc -l | tr -d ' ')" = 1
test "$(git grep -h 'group: arconath-jit' -- '.github/workflows/*' | wc -l | tr -d ' ')" = 1
test "$(git grep -h 'labels: r640-trusted' -- '.github/workflows/*' | wc -l | tr -d ' ')" = 1
git grep -q 'pull_request_target:' -- '.github/workflows/quality.yml'
if git grep -q '^  pull_request:$' -- '.github/workflows/quality.yml'; then
  echo 'Untrusted pull_request events may not reach the private runner.' >&2
  exit 1
fi
echo 'Repository, owner-only R640 quality, and trusted release boundaries verified.'
