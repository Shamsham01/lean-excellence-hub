#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:${PATH:-}"

cd /workspace

node --version
npm --version

npm ci
npx playwright install --with-deps chromium
