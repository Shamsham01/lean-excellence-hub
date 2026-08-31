#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:${PATH:-}"

cd /workspace

node --version
npm --version

npm ci
npx playwright install chromium

export CREDENTIAL_ENCRYPTION_KEY="${CREDENTIAL_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
bash .cursor/scripts/verify-cloud-startup.sh
