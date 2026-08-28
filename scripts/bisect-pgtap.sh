#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
files=(supabase/tests/database/*.sql)

if ((${#files[@]} == 0)); then
  echo "No pgTAP files found under supabase/tests/database"
  exit 1
fi

failed=()

for file in "${files[@]}"; do
  echo "=== pgTAP: ${file} ==="
  if ! npx supabase test db --local "${file}"; then
    failed+=("${file}")
    echo "::error file=${file}::pgTAP failed for ${file}"
  fi
done

if ((${#failed[@]} > 0)); then
  echo "Failed pgTAP files (${#failed[@]}):"
  printf ' - %s\n' "${failed[@]}"
  exit 1
fi

echo "All ${#files[@]} pgTAP files passed"
