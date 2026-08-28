#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
files=(supabase/tests/database/*.sql)

if ((${#files[@]} == 0)); then
  echo "No pgTAP files found under supabase/tests/database"
  exit 1
fi

for file in "${files[@]}"; do
  echo "=== pgTAP: ${file} ==="
  if ! npx supabase test db --local "${file}"; then
    echo "::error file=${file}::pgTAP failed for ${file}"
    exit 1
  fi
done

echo "All ${#files[@]} pgTAP files passed"
