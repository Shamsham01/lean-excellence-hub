#!/usr/bin/env python3
"""Emit consolidated module-entitlement asserts on private write RPC bodies."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"
OUT_NAME = "20261109030000_billing_comprehensive_module_mutation_gates.sql"

DEPRIORITISE = frozenset(
    {
        "20261108235000_billing_09_extended_module_gates.sql",
        "20261108232000_billing_06_module_mutation_gates.sql",
    }
)

AI_RUN_MUTATIONS = frozenset(
    {
        "start_ai_run",
        "claim_ai_run_execution",
        "fail_ai_run",
        "finish_ai_run",
        "record_ai_proposal_accepted",
        "record_ai_run_provider_dispatch",
        "record_leanai_semantic_event",
        "recover_stale_ai_runs_for_problem_solving_case",
        "reject_ai_proposal",
        "sync_leanai_operational_chase_notifications",
    }
)

AI_SESSION_CREATES = frozenset({"create_ai_session", "create_ai_coach_session"})

AI_ASSERT_BY_RUN_ID = frozenset(
    {
        "finish_ai_run",
        "fail_ai_run",
        "claim_ai_run_execution",
        "record_ai_run_provider_dispatch",
    }
)

AI_ASSERT_BY_PROPOSAL = frozenset(
    {"record_ai_proposal_accepted", "reject_ai_proposal"}
)

AI_ASSERT_PS_MODULE = frozenset(
    {
        "recover_stale_ai_runs_for_problem_solving_case",
    }
)

AI_ASSERT_ORG_SETTINGS = frozenset({"sync_leanai_operational_chase_notifications"})

ARTIFACT = ROOT / "docs/operations/rpc-entitlement-inventory.md"
# Foundation / cross-plan operations — never add plan asserts.
FOUNDATION_RPC_UNGATED = frozenset(
    {
        "create_job_function",
        "update_job_function",
        "preauthorize_workforce_provision",
    }
)
WORKFORCE_IDENTITY_IMPORT_FOUNDATION = frozenset(
    {
        "archive_workforce_import_job",
        "claim_workforce_import_batch",
        "create_workforce_import_job",
        "retry_workforce_import_failed_rows",
        "start_workforce_import_provisioning",
        "submit_workforce_import_rows",
        "validate_workforce_import_job",
    }
)
FOUNDATION_RPC_EXCLUDE = FOUNDATION_RPC_UNGATED | WORKFORCE_IDENTITY_IMPORT_FOUNDATION | frozenset(
    {"ensure_problem_solving_methods_provisioned"}
)

CANONICAL_SOURCE_FILE = {
    "finish_ai_run": "20261109024000_billing_07_leanai_credit_lifecycle.sql",
    "fail_ai_run": "20261109024000_billing_07_leanai_credit_lifecycle.sql",
}

SQL_DELEGATE_GATES: dict[str, str] = {
    "remove_training_session_participant": "training",
}

MODULE_BY_FUNCTION: dict[str, str] = {}
PUBLIC_ONLY = frozenset(
    {
        "ack_workforce_import_credentials_exported",
        "assert_workforce_import_credential_export_access",
        "begin_workforce_import_credential_export",
        "mark_workforce_import_credentials_exported",
        "preauthorize_workforce_credential_reset",
    }
)


def parse_inventory() -> None:
    if not ARTIFACT.exists():
        raise SystemExit(f"Missing inventory {ARTIFACT} (commit docs/operations/rpc-entitlement-inventory.md)")
    for line in ARTIFACT.read_text().splitlines():
        if not line.startswith("| `"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 5:
            continue
        fn = parts[1].strip("`")
        if fn in FOUNDATION_RPC_EXCLUDE:
            continue
        mod = parts[2].strip()
        if mod == "ai" and fn not in AI_RUN_MUTATIONS and fn not in AI_SESSION_CREATES:
            continue
        if mod == "people_hr" and (
            fn.startswith(
                (
                    "create_people_invitation",
                    "claim_people_invitation",
                    "finalize_people_invitation",
                    "start_people_invitation",
                    "submit_people_invitation",
                    "validate_people_invitation",
                )
            )
            or fn.endswith("_people_invitation_import_batch")
            or fn.endswith("_people_invitation_import_job")
        ):
            continue
        if fn in WORKFORCE_IDENTITY_IMPORT_FOUNDATION:
            MODULE_BY_FUNCTION[fn] = "foundation"
        elif fn in PUBLIC_ONLY:
            MODULE_BY_FUNCTION[fn] = "people_hr"
        else:
            MODULE_BY_FUNCTION[fn] = (
                mod if mod != "ai" or fn in AI_SESSION_CREATES else "ai_run"
            )
    for fn in WORKFORCE_IDENTITY_IMPORT_FOUNDATION:
        MODULE_BY_FUNCTION.setdefault(fn, "foundation")
    for fn in PUBLIC_ONLY:
        if fn not in MODULE_BY_FUNCTION:
            MODULE_BY_FUNCTION[fn] = "people_hr"
    for fn in FOUNDATION_RPC_UNGATED:
        MODULE_BY_FUNCTION.setdefault(fn, "foundation")


def migration_order() -> list[Path]:
    return sorted(MIGRATIONS.glob("*.sql"), key=lambda p: p.name)


def extract_function(sql: str, name: str, *, public: bool = False) -> str | None:
    schema = "public" if public else "private"
    marker = f"create or replace function {schema}.{name}("
    start = sql.lower().find(marker.lower())
    if start < 0:
        return None
    sub = sql[start:]
    end_match = re.search(r"\$\$;\s*", sub)
    if not end_match:
        return None
    return sub[: end_match.end()].strip()


def collect_versions(name: str) -> list[tuple[str, str, int]]:
    versions: list[tuple[str, str, int]] = []
    for path in migration_order():
        if path.name >= OUT_NAME:
            continue
        body = extract_function(
            path.read_text(),
            name,
            public=(name in PUBLIC_ONLY or name in WORKFORCE_IDENTITY_IMPORT_FOUNDATION),
        )
        if body:
            versions.append((path.name, body, len(body)))
    return versions


def pick_canonical(name: str) -> str | None:
    preferred = CANONICAL_SOURCE_FILE.get(name)
    if preferred:
        path = MIGRATIONS / preferred
        if path.exists():
            body = extract_function(path.read_text(), name)
            if body:
                return body
    versions = collect_versions(name)
    if not versions:
        return None
    if name in FOUNDATION_RPC_EXCLUDE:
        for path_name, body, _ in sorted(versions, key=lambda v: v[0], reverse=True):
            if path_name >= OUT_NAME:
                continue
            if "assert_current_organisation_module_entitled" not in body:
                return body
    good = [v for v in versions if v[0] not in DEPRIORITISE and v[0] < OUT_NAME]
    pool = good if good else [v for v in versions if v[0] < OUT_NAME]
    pool.sort(key=lambda v: v[0])
    return pool[-1][1] if pool else versions[-1][1]


AUTH_BLOCK = re.compile(
    r"(if org_id is null.*?using errcode = '42501';\s*\n\s*end if;\s*\n)",
    re.DOTALL | re.IGNORECASE,
)


def after_auth_insert(body: str, insert: str) -> str:
    if insert.strip() in body:
        return body
    m = AUTH_BLOCK.search(body)
    if m:
        return body[: m.end()] + insert + body[m.end() :]
    m2 = re.search(r"\nbegin\n", body, re.IGNORECASE)
    if m2:
        return body[: m2.end()] + insert + body[m2.end() :]
    return body


def inject_start_ai_run_credit_reserve(body: str) -> str:
    if "leanai_ai_run_reserve_upper_bound" in body:
        return body
    hook = """
  if not coalesce(
    private.leanai_ai_run_try_reserve(
      org_id,
      new_run_id,
      btrim(target_idempotency_key),
      btrim(target_provider),
      btrim(target_model),
      btrim(target_user_message)
    ),
    true
  ) then
    raise exception 'leanai credit allowance exceeded for this period'
      using errcode = '42501';
  end if;

"""
    needle = "  return new_run_id;\nend;\n$$;"
    needle = "  return new_run_id;\nend;\n$$;"
    if needle in body:
        return body.replace(needle, hook + needle, 1)
    return body


def patch_finish_ai_run_cost_settle(body: str) -> str:
    token_settle = """perform private.ai_credit_settle(
    target_ai_run_id,
    greatest(
      1::bigint,
      (coalesce(target_input_tokens, 0) + coalesce(target_output_tokens, 0))::bigint
    )
  );"""
    cost_settle = """perform private.ai_credit_settle_from_run_usage(
    target_ai_run_id,
    coalesce(target_input_tokens, 0),
    coalesce(target_output_tokens, 0),
    coalesce(target_cached_input_tokens, 0),
    coalesce(target_reasoning_tokens, 0)
  );"""
    if cost_settle in body:
        return body
    return body.replace(token_settle, cost_settle)


def sql_delegate_to_plpgsql(fn: str, body: str, module: str) -> str:
    """Gate SQL-language delegates that call another private RPC."""
    m = re.search(
        rf"create or replace function private\.{fn}\([^)]*\)\s*returns\s+(\w+).*?as \$\$\s*(.+?)\s*\$\$;",
        body,
        re.I | re.S,
    )
    if not m:
        return body
    return_type = m.group(1)
    inner = m.group(2).strip().rstrip(";")
    if inner.lower().startswith("select "):
        inner = inner[7:].strip()
    sig_m = re.search(rf"function private\.{fn}\(([^)]*)\)", body, re.I)
    args = sig_m.group(1) if sig_m else ""
    return f"""create or replace function private.{fn}({args})
returns {return_type}
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'operation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('{module}');

  return {inner.rstrip()};
end;
$$;"""


def patch_function(fn: str, body: str) -> str:
    if fn in FOUNDATION_RPC_EXCLUDE or MODULE_BY_FUNCTION.get(fn) == "foundation":
        body = re.sub(
            r"\s*perform private\.assert_current_organisation_module_entitled\([^)]+\);\s*\n",
            "\n",
            body,
        )
        return body

    if fn in SQL_DELEGATE_GATES:
        return sql_delegate_to_plpgsql(fn, body, SQL_DELEGATE_GATES[fn])

    if fn == "finish_ai_run":
        body = patch_finish_ai_run_cost_settle(body)

    if fn != "start_ai_run" and (
        "assert_current_organisation_module_entitled" in body
        or "assert_ai_session_module_entitled" in body
    ):
        return body

    if fn not in MODULE_BY_FUNCTION:
        raise SystemExit(f"inventory missing module for {fn}")

    module = MODULE_BY_FUNCTION[fn]

    if fn == "create_ai_coach_session":
        return after_auth_insert(
            body,
            "  perform private.assert_ai_session_module_entitled('coach', btrim(target_module_key));\n\n",
        )
    if fn == "create_ai_session":
        if "assert_current_organisation_module_entitled('problem_solving')" in body:
            return body
        return after_auth_insert(
            body,
            "  perform private.assert_current_organisation_module_entitled('problem_solving');\n\n",
        )

    if fn == "start_ai_run":
        ins = """
  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_sessions s
     where s.organisation_id = org_id and s.id = target_ai_session_id),
    (select s.module_key from public.ai_sessions s
     where s.organisation_id = org_id and s.id = target_ai_session_id)
  );

"""
        if "assert_ai_session_module_entitled" not in body:
            body = after_auth_insert(body, ins)
        return inject_start_ai_run_credit_reserve(body)

    if fn == "record_leanai_semantic_event":
        return after_auth_insert(
            body,
            """  if coalesce(target_module_key, '') not in ('onboarding') then
    perform private.assert_current_organisation_module_entitled('problem_solving');
  end if;

""",
        )

    if fn in AI_ASSERT_PS_MODULE:
        return after_auth_insert(
            body,
            "  perform private.assert_current_organisation_module_entitled('problem_solving');\n\n",
        )

    if fn in AI_ASSERT_ORG_SETTINGS:
        return body

    if fn in AI_RUN_MUTATIONS:
        if fn in AI_ASSERT_BY_PROPOSAL:
            ins = """
  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_proposals p
       join public.ai_sessions s
         on s.organisation_id = p.organisation_id and s.id = p.ai_session_id
     where p.organisation_id = org_id and p.id = target_ai_proposal_id),
    (select s.module_key from public.ai_proposals p
       join public.ai_sessions s
         on s.organisation_id = p.organisation_id and s.id = p.ai_session_id
     where p.organisation_id = org_id and p.id = target_ai_proposal_id)
  );

"""
        elif fn in AI_ASSERT_BY_RUN_ID:
            ins = """
  perform private.assert_ai_session_module_entitled(
    (select s.context_type from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id),
    (select s.module_key from public.ai_runs r
       join public.ai_sessions s on s.id = r.ai_session_id
     where r.organisation_id = org_id and r.id = target_ai_run_id)
  );

"""
            return after_auth_insert(body, ins)
        if fn in AI_ASSERT_BY_PROPOSAL:
            return after_auth_insert(body, ins)
        return body

    ins = (
        f"  perform private.assert_current_organisation_module_entitled('{module}');\n\n"
    )
    return after_auth_insert(body, ins)


def main() -> None:
    parse_inventory()
    out: list[str] = [
        "-- Canonical private write RPC bodies + plan module asserts only.",
        "-- Regenerate: python3 scripts/generate-billing-module-gates.py",
        "",
    ]
    missing: list[str] = []
    for fn in sorted(MODULE_BY_FUNCTION.keys()):
        body = pick_canonical(fn)
        if not body:
            missing.append(fn)
            continue
        out.append(patch_function(fn, body))
        out.append("")

    path = MIGRATIONS / OUT_NAME
    path.write_text("\n".join(out))
    done = len(MODULE_BY_FUNCTION) - len(missing)
    print(f"Wrote {path.name}: {done} functions, {len(missing)} missing")
    for fn in sorted(FOUNDATION_RPC_EXCLUDE):
        if fn in MODULE_BY_FUNCTION:
            continue
        body = pick_canonical(fn)
        if not body:
            continue
        out.append(body)
        out.append("")

    if missing:
        print("Missing:", ", ".join(missing))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
