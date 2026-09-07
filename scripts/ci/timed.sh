#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <label> <command> [args...]" >&2
  exit 2
fi

label="$1"
shift
start_epoch="$(date +%s)"

"$@"

end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "- ${label}: ${duration}s" >> "${GITHUB_STEP_SUMMARY}"
fi

echo "${label} completed in ${duration}s"
