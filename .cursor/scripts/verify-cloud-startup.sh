#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:${PATH:-}"

cd /workspace

log() {
  printf '[verify-cloud-startup] %s\n' "$*"
}

failures=0

check() {
  local label="$1"
  shift
  log "CHECK: ${label}"
  if "$@"; then
    log "PASS: ${label}"
  else
    log "FAIL: ${label}"
    failures=$((failures + 1))
  fi
}

log "Running non-interactive startup verification"

check "start script (first run)" bash .cursor/scripts/cloud-start-docker.sh
check "docker info" docker info
check "docker hello-world" docker run --rm hello-world
check "npm run db:start" npm run db:start
check "npx supabase status" npx supabase status
check "npm run test:db" npm run test:db
check "start script (second run)" bash .cursor/scripts/cloud-start-docker.sh

if [[ "${SUPABASE_SERVICE_ROLE_KEY:-}" == *"production"* ]] || [[ "${NEXT_PUBLIC_SUPABASE_URL:-}" == *"supabase.co"* ]]; then
  log "FAIL: production Supabase credentials detected"
  failures=$((failures + 1))
else
  log "PASS: no production Supabase credentials detected"
fi

if [[ "${failures}" -gt 0 ]]; then
  log "Verification failed with ${failures} error(s)"
  exit 1
fi

log "All verification checks passed"
