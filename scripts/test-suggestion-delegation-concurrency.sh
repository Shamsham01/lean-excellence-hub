#!/usr/bin/env bash
# Two concurrent psql sessions delegate to different targets; one active assignment remains.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_URL="$(npx supabase status -o json | node -e '
  const fs = require("fs");
  const input = fs.readFileSync(0, "utf8");
  const start = input.indexOf("{");
  const j = JSON.parse(input.slice(start));
  if (!j.DB_URL) process.exit(1);
  process.stdout.write(j.DB_URL);
')"

run_psql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DB_URL" "$@"
    return
  fi
  local db_container
  db_container="$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -1)"
  if [[ -z "$db_container" ]]; then
    echo "suggestion-delegation-concurrency: psql unavailable and no supabase_db container" >&2
    exit 1
  fi
  local args=()
  local sql_file=""
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "-f" ]]; then
      shift
      sql_file="$1"
      shift
      continue
    fi
    args+=("$1")
    shift
  done
  if [[ -n "$sql_file" ]]; then
    docker exec -i "$db_container" psql -U postgres -d postgres "${args[@]}" -v ON_ERROR_STOP=1 <"$sql_file"
    return
  fi
  docker exec -i "$db_container" psql -U postgres -d postgres "${args[@]}"
}

SEED_SQL="$ROOT/scripts/fixtures/suggestion-delegation-concurrency-seed.sql"
RACE_A="$ROOT/scripts/fixtures/suggestion-delegation-concurrency-race-a.sql"
RACE_B="$ROOT/scripts/fixtures/suggestion-delegation-concurrency-race-b.sql"

if ! run_psql -v ON_ERROR_STOP=1 -f "$SEED_SQL" >/dev/null; then
  run_psql -v ON_ERROR_STOP=1 -c "
    insert into private._t119_conc_ids (key, id)
    select 'organisation', id from public.organisations where code = 't119-conc-delegation'
    on conflict (key) do update set id = excluded.id;
    insert into private._t119_conc_ids (key, id)
    select 'suggestion', s.id
    from public.improvement_suggestions s
    join public.organisations o on o.id = s.organisation_id
    where o.code = 't119-conc-delegation' and s.title = 'T119 conc race suggestion'
    on conflict (key) do update set id = excluded.id;
  " >/dev/null
fi

run_psql -v ON_ERROR_STOP=0 -f "$RACE_A" >/tmp/race-a.log 2>&1 &
pid_a=$!
run_psql -v ON_ERROR_STOP=0 -f "$RACE_B" >/tmp/race-b.log 2>&1 &
pid_b=$!
wait "$pid_a" || true
wait "$pid_b" || true

active_count="$(run_psql -v ON_ERROR_STOP=1 -t -A -c \
  "select count(*)::text
   from public.suggestion_review_assignments assignment_row
   where assignment_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
     and assignment_row.suggestion_id = (select id from private._t119_conc_ids where key = 'suggestion')
     and assignment_row.status = 'active'")"

if [[ "$active_count" != "1" ]]; then
  echo "suggestion-delegation-concurrency: expected 1 active assignment, got ${active_count}" >&2
  cat /tmp/race-a.log /tmp/race-b.log >&2
  exit 1
fi

echo '{"scope":"suggestion-delegation-concurrency","activeAssignments":1,"result":"PASS"}'
