#!/usr/bin/env python3
"""Emit SQL to revoke PUBLIC/anon/authenticated execute on inventoried private writers."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs/operations/rpc-entitlement-inventory.md"
OUT = ROOT / "supabase/migrations/20261109033000_billing_09_private_write_grant_hardening.sql"

EXEMPT_AUTHENTICATED_PRIVATE_EXECUTE = frozenset(
    {
        "record_leanai_semantic_event",
    }
)


def private_functions() -> list[str]:
    names: list[str] = []
    for line in INVENTORY.read_text().splitlines():
        if not line.startswith("| `"):
            continue
        fn = line.split("|")[1].strip().strip("`")
        names.append(fn)
    return sorted(set(names))


def main() -> None:
    fns = [fn for fn in private_functions() if fn not in EXEMPT_AUTHENTICATED_PRIVATE_EXECUTE]
    lines = [
        "-- AUTO-GENERATED: python3 scripts/audit-private-write-grants.py",
        "-- Revoke default PUBLIC execute on reachable private write RPCs.",
        "-- Skips when a public SECURITY INVOKER wrapper with the EXACT same identity",
        "-- arguments remains granted to authenticated.",
        "",
        "do $$",
        "declare",
        "  proc_row record;",
        "begin",
        "  for proc_row in",
        "    select",
        "      n.nspname as schema_name,",
        "      p.proname as function_name,",
        "      pg_catalog.pg_get_function_identity_arguments(p.oid) as args",
        "    from pg_catalog.pg_proc p",
        "    join pg_catalog.pg_namespace n on n.oid = p.pronamespace",
        "    where n.nspname = 'private'",
        f"      and p.proname in ({', '.join(repr(n) for n in fns)})",
        "  loop",
        "    if exists (",
        "      select 1",
        "      from pg_catalog.pg_proc pub",
        "      join pg_catalog.pg_namespace pub_ns on pub_ns.oid = pub.pronamespace",
        "      where pub_ns.nspname = 'public'",
        "        and pub.proname = proc_row.function_name",
        "        and pub.prosecdef = false",
        "        and pg_catalog.pg_get_function_identity_arguments(pub.oid) = proc_row.args",
        "        and pg_catalog.has_function_privilege('authenticated', pub.oid, 'EXECUTE')",
        "    ) then",
        "      continue;",
        "    end if;",
        "    execute format(",
        "      'revoke all on function %I.%I(%s) from public, anon, authenticated',",
        "      proc_row.schema_name,",
        "      proc_row.function_name,",
        "      proc_row.args",
        "    );",
        "    execute format(",
        "      'grant execute on function %I.%I(%s) to lean_hub_private_owner',",
        "      proc_row.schema_name,",
        "      proc_row.function_name,",
        "      proc_row.args",
        "    );",
        "  end loop;",
        "end $$;",
        "",
    ]
    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT.name} for {len(fns)} inventoried private functions")


if __name__ == "__main__":
    main()
