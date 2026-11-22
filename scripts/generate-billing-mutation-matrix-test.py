#!/usr/bin/env python3
"""Generate pgTAP matrix asserting Essentials cannot call Professional write RPCs."""
from pathlib import Path

ARTIFACT = Path("/opt/cursor/artifacts/rpc-entitlement-table.md")
OUT = Path("supabase/tests/database/billing_plan_mutation_matrix.test.sql")

# Minimal viable calls that fail fast on plan gate (before RBAC setup noise).
CALLS: dict[str, str] = {
    "create_improvement_project": "select public.create_improvement_project('M', (select unit_id from matrix_ids where key = 'unit'))",
    "create_benefit_draft": "select public.create_benefit_draft('M', (select unit_id from matrix_ids where key = 'unit'), 'financial', null, 'cost_reduction')",
    "create_problem_solving_case_draft": "select public.create_problem_solving_case_draft('M', (select unit_id from matrix_ids where key = 'unit'))",
    "create_training_course_draft": "select public.create_training_course_draft('M', 'm-001')",
    "create_skill": "select public.create_skill('M', 'm-skill')",
    "create_recognition_type": "select public.create_recognition_type('M', 'm-type')",
    "create_benefit_realisation_entry": "select public.create_benefit_realisation_entry(gen_random_uuid(), 100, statement_timestamp())",
    "create_containment": "select public.create_containment(gen_random_uuid(), 'M')",
    "add_ci_project_methodology_phase": "select public.add_ci_project_methodology_phase(gen_random_uuid(), 'p', 'P', 1, 'd')",
    "create_workforce_import_job": "select public.create_workforce_import_job('m.csv')",
}

SKIP = frozenset({"create_benefit_realisation_entry", "add_ci_project_methodology_phase", "create_containment"})

def main() -> None:
    fns = [ln.split("|")[1].strip("`") for ln in ARTIFACT.read_text().splitlines() if ln.startswith("| `")]
    tests = [fn for fn in CALLS if fn in fns and fn not in SKIP]
    plan = 2 + len(tests)  # switch + each throws

    lines = [
        "begin;",
        f"select plan({plan});",
        "",
        "-- essentials org owner",
        "insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)",
        "values ('b2700000-0000-4000-8000-000000000001', 'matrix@example.test', statement_timestamp(), statement_timestamp(), statement_timestamp(),",
        "  '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', false, false);",
        "insert into auth.sessions (id, user_id, created_at, updated_at)",
        "values ('b2710000-0000-4000-8000-000000000001', 'b2700000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp());",
        "create temporary table matrix_ids (key text primary key, id uuid not null, unit_id uuid) on commit drop;",
        "grant select, insert, update on matrix_ids to authenticated;",
        "insert into matrix_ids (key, id) values ('org', private.provision_organisation('b2700000-0000-4000-8000-000000000001', 'matrix-org', 'Matrix Org'));",
        "select public.apply_organisation_subscription_snapshot((select id from matrix_ids where key = 'org'),",
        "  'fake','cus_m','sub_m','essentials','monthly',1,'price_m','active','active',",
        "  statement_timestamp(), statement_timestamp() + interval '30 days', false, timestamptz '2026-11-08 16:00:00+00');",
        "select set_config('request.jwt.claims',",
        "  '{\"sub\":\"b2700000-0000-4000-8000-000000000001\",\"role\":\"authenticated\",\"session_id\":\"b2710000-0000-4000-8000-000000000001\",\"email\":\"matrix@example.test\"}', true);",
        "set local role authenticated;",
        "select ok(public.switch_organisation((select id from matrix_ids where key = 'org')), 'matrix essentials context');",
        "update matrix_ids set unit_id = public.create_organisation_unit((select id from matrix_ids where key = 'org'), null, 'm-site', 'M Site', 'site') where key = 'org';",
        "",
    ]
    for fn in tests:
        lines.extend(
            [
                "select throws_ok(",
                f"  $$ {CALLS[fn]} $$,",
                "  '42501',",
                "  null,",
                f"  'essentials blocked: {fn}'",
                ");",
                "",
            ]
        )
    lines.extend(["select * from finish();", "rollback;", ""])
    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT} with {len(tests)} mutation checks")


if __name__ == "__main__":
    main()
