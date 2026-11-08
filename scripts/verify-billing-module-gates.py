#!/usr/bin/env python3
"""Verify billing_40 gate migration only adds plan asserts vs canonical baseline."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"
GATE_FILE = MIGRATIONS / "20261109000000_billing_comprehensive_module_mutation_gates.sql"
DEPRIORITISE = frozenset(
    {
        "20261108235000_billing_09_extended_module_gates.sql",
        "20261108232000_billing_06_module_mutation_gates.sql",
        "20261109000000_billing_comprehensive_module_mutation_gates.sql",
    }
)

ASSERT_PATTERNS = [
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
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in DEPRIORITISE or path.name == GATE_FILE.name:
            continue
        for key, body in extract_all(path).items():
            if key == f"private.{name}":
                if chosen is None or path.name > chosen_file:
                    chosen = body
                    chosen_file = path.name
    return chosen


def main() -> int:
    if not GATE_FILE.exists():
        print(f"Missing {GATE_FILE}", file=sys.stderr)
        return 1
    gated = extract_all(GATE_FILE)
    failures: list[str] = []
    for key, body in sorted(gated.items()):
        if not key.startswith("private."):
            continue
        name = key.split(".", 1)[1]
        base = canonical_private(name)
        if not base:
            failures.append(f"{name}: no canonical baseline")
            continue
        if normalize(body) != normalize(base):
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
