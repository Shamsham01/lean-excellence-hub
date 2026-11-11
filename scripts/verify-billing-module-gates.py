#!/usr/bin/env python3
"""Verify billing_40 gate migration only adds plan asserts vs canonical baseline."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"
GATE_FILE = MIGRATIONS / "20261109030000_billing_comprehensive_module_mutation_gates.sql"
INVENTORY = ROOT / "docs/operations/rpc-entitlement-inventory.md"

STRUCTURAL_REWRITES = frozenset(
    {
        "remove_training_session_participant",
        "finish_ai_run",
        "fail_ai_run",
        "start_ai_run",
    }
)

REQUIRED_ASSERT_SNIPPETS: dict[str, list[str]] = {
    "record_ai_proposal_accepted": ["assert_ai_session_module_entitled"],
    "reject_ai_proposal": ["assert_ai_session_module_entitled"],
    "start_ai_run": ["assert_ai_session_module_entitled", "leanai_ai_run_try_reserve"],
    "finish_ai_run": ["ai_credit_settle_from_run_usage"],
    "fail_ai_run": ["ai_credit_release"],
    "remove_training_session_participant": [
        "assert_current_organisation_module_entitled('training')"
    ],
    "preauthorize_workforce_provision": [],  # foundation — must not carry people_hr assert
}
DEPRIORITISE = frozenset(
    {
        "20261108235000_billing_09_extended_module_gates.sql",
        "20261108232000_billing_06_module_mutation_gates.sql",
        "20261109030000_billing_comprehensive_module_mutation_gates.sql",
    }
)

ASSERT_PATTERNS = [
    re.compile(
        r"if coalesce\(target_module_key, ''\) not in \('onboarding'\) then\s*"
        r"perform private\.assert_current_organisation_module_entitled\('problem_solving'\);\s*"
        r"end if;",
        re.I | re.S,
    ),
    re.compile(
        r"if not coalesce\(\s*private\.leanai_ai_run_try_reserve\([^;]+;\s*end if;",
        re.I | re.S,
    ),
    re.compile(r"perform private\.ai_credit_settle_from_run_usage\([^;]+;", re.I),
    re.compile(r"perform private\.ai_credit_settle\([^;]+;", re.I),
    re.compile(r"perform private\.ai_credit_release\([^;]+;", re.I),
    re.compile(r"perform private\.assert_current_organisation_module_entitled\([^)]+\);", re.I),
    re.compile(r"perform private\.assert_ai_session_module_entitled\([^;]+;", re.I | re.S),
]


def normalize(body: str) -> str:
    out = body
    for pat in ASSERT_PATTERNS:
        out = pat.sub("", out)
    out = re.sub(r"\s+", " ", out.strip().lower())
    return out


def extract_all(path: Path) -> dict[str, str]:
    text = path.read_text()
    out: dict[str, str] = {}
    for m in re.finditer(
        r"create or replace function (private|public)\.(\w+)\([^)]*\)",
        text,
        re.I,
    ):
        schema, name = m.group(1).lower(), m.group(2)
        key = f"{schema}.{name}"
        start = m.start()
        sub = text[start:]
        end = re.search(r"\$\$;\s*", sub)
        if end:
            out[key] = sub[: end.end()].strip()
    return out


def canonical_private(name: str) -> str | None:
    chosen = None
    chosen_file = ""
    gate_name = GATE_FILE.name
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in DEPRIORITISE or path.name >= gate_name:
            continue
        for key, body in extract_all(path).items():
            if key == f"private.{name}":
                if chosen is None or path.name > chosen_file:
                    chosen = body
                    chosen_file = path.name
    return chosen


def main() -> int:
    if not INVENTORY.exists():
        print(f"Missing {INVENTORY}", file=sys.stderr)
        return 1
    if not GATE_FILE.exists():
        print(f"Missing {GATE_FILE}", file=sys.stderr)
        return 1
    gated = extract_all(GATE_FILE)
    failures: list[str] = []
    for fn, snippets in REQUIRED_ASSERT_SNIPPETS.items():
        body = gated.get(f"private.{fn}", "")
        if not body:
            failures.append(f"{fn}: missing from gate migration")
            continue
        for snippet in snippets:
            if snippet and snippet not in body:
                failures.append(f"{fn}: missing required gate/hook `{snippet}`")
        if fn == "preauthorize_workforce_provision":
            if "assert_current_organisation_module_entitled('people_hr')" in body:
                failures.append(f"{fn}: foundation RPC must not be people_hr gated")
    for key, body in sorted(gated.items()):
        if not key.startswith("private."):
            continue
        name = key.split(".", 1)[1]
        base = canonical_private(name)
        if not base:
            failures.append(f"{name}: no canonical baseline")
            continue
        if name not in STRUCTURAL_REWRITES and normalize(body) != normalize(base):
            failures.append(f"{name}: body drift vs {canonical_private.__name__}")
    print(f"Checked {len([k for k in gated if k.startswith('private.')])} private functions")
    if failures:
        print(f"FAIL {len(failures)} drift(s):")
        for f in failures[:40]:
            print(" -", f)
        if len(failures) > 40:
            print(f" ... and {len(failures) - 40} more")
        return 1
    print("OK: all gated bodies match canonical modulo asserts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
