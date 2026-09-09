# CookieWorks Two-Site Smoke Runbook

Manual smoke checklist for hosted CookieWorks Manufacturing after PR4 merge.
This runbook prepares the maintainer handoff only — **do not execute hosted destructive steps from a development PR**.

## Final foundation contract

| Item | Expected value |
| --- | --- |
| Organisation | CookieWorks Manufacturing (`cookieworks-manufacturing`) |
| Site 1 | Bodmin Cookie Factory (`bodmin-cookie-factory`) |
| Site 2 | Exeter Cookie Factory (`exeter-cookie-factory`) |
| Bodmin units | 10 (existing hierarchy preserved) |
| Exeter units | 6 (Operations, Mixing & Preparation, Baking, Packing, Quality) |
| Total units | 16 |
| Permanent personas | 8 |

### Permanent personas and intended scopes

| Persona key | Display name | Email | Scope |
| --- | --- | --- | --- |
| `admin` | CookieWorks Admin | `admin@cookieworks.local` | Owner / organisation admin |
| `ciManager` | CookieWorks CI Manager | `ci-manager@cookieworks.local` | Organisation-wide |
| `productionManager` | CookieWorks Production Manager | `production-manager@cookieworks.local` | Bodmin Operations subtree |
| `exeterProductionManager` | Exeter Production Manager | `exeter-production-manager@cookieworks.local` | Exeter Operations subtree |
| `teamLeader` | CookieWorks Team Leader | `team-leader@cookieworks.local` | Bodmin Operations subtree |
| `operator` | CookieWorks Operator | `operator@cookieworks.local` | Self (Bodmin shop-floor placement) |
| `assessor` | CookieWorks Assessor | `assessor@cookieworks.local` | Organisation-wide |
| `finance` | CookieWorks Finance | `finance@cookieworks.local` | Organisation-wide |

Foundation-only state after reset:

- zero module business data
- zero maturity frameworks / assessments / evidence
- zero Suggestions, Projects/Benefits, 5S/Gemba, Problem Solving business rows
- zero Training/Skills transactional business data beyond allowed catalogue/bootstrap
- no Apex/demo tenant leakage

Local verification commands (`npm run qa:cookie:inventory` is **local Supabase only** — it uses `loadLocalSupabaseEnv()` and must not be used against hosted credentials):

```bash
npm run db:reset
npm run db:seed-demo
LEANHUB_ALLOW_QA_TENANT=1 npm run qa:cookie:reset
LEANHUB_ALLOW_QA_TENANT=1 npm run qa:cookie:reset   # prove idempotence
npm run qa:cookie:inventory   # local-only inventory report
```

## Hosted rollout — DO NOT EXECUTE IN PR4

Maintainer sequence after merge and CI green on `main`:

1. Pull latest `main`.
2. Check hosted migration status (`supabase migration list` against hosted project).
3. Run hosted CookieWorks dry-run plan (read-only; uses hosted credentials):
   ```bash
   npm run qa:cookie:hosted-replacement -- --dry-run
   ```
   When CookieWorks is already present, this dry-run invokes the **complete PR4 foundation verifier** (8 personas, 16 units, 2 site roots, workforce placements, clean module state).
4. Apply pending database migrations only with explicit maintainer approval.
5. Rebuild/update CookieWorks foundation using the guarded hosted path:
   ```bash
   LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY npm run qa:cookie:hosted-replacement -- --destructive
   ```
   Or, if CookieWorks already exists and only foundation refresh is required:
   ```bash
   LEANHUB_ALLOW_QA_TENANT=1 npm run qa:cookie:hosted-seed
   ```
6. Verify final hosted foundation (read-only — do **not** use `npm run qa:cookie:inventory`, which is local-only):
   ```bash
   npm run qa:cookie:hosted-replacement -- --dry-run
   ```
   Expect dry-run assessment to report CookieWorks foundation verified with the complete PR4 contract: 1 organisation, 2 site roots, 16 units, 8 personas, 8 active role grants, 3 job functions, 4 placements, zero module business rows.
7. Log into hosted app with foundation personas.
8. Begin manual smoke (below).

## Manual smoke order

Record each step as **PASS**, **DEFECT**, **PRODUCT GAP**, or **BLOCKED**.

### Organisation foundation (start here)

| ID | Area | Actor | Check |
| --- | --- | --- | --- |
| ORG-01 | Organisation Structure | `admin` | Both site roots visible; Bodmin hierarchy intact; Exeter compact hierarchy visible |
| ORG-02 | Access & Responsibilities | `admin`, `productionManager`, `exeterProductionManager`, `ciManager` | Scope pickers respect site boundaries; org-wide actors span both sites |

### Module smoke (sensible sequence)

| ID | Module | Suggested actor |
| --- | --- | --- |
| MAT-01 | Maturity | `ciManager`, `assessor` |
| 5S-01 | 5S | `productionManager`, `exeterProductionManager` |
| GEM-01 | Gemba | `productionManager`, `teamLeader` |
| SCH-01 | Schedule | `productionManager` |
| SUG-01 | Suggestions | `operator`, `teamLeader` |
| PS-01 | Problem Solving | `productionManager` |
| PRJ-01 | Projects | `ciManager` |
| BEN-01 | Benefits | `finance`, `ciManager` |
| TRN-01 | Training | `ciManager` |
| SKL-01 | Skills | `ciManager` |
| REC-01 | Recognition | `teamLeader` |
| AI-01 | AI (where enabled) | `ciManager` |

## Site isolation spot checks

During smoke, confirm:

- Bodmin `productionManager` cannot enumerate or manage Exeter units.
- Exeter `exeterProductionManager` cannot enumerate or manage Bodmin operational units outside legitimate access.
- `ciManager` / `admin` legitimately see both sites.
- Cross-site reparent remains rejected.

## Result convention

| Result | Meaning |
| --- | --- |
| **PASS** | Expected behaviour confirmed |
| **DEFECT** | Bug — behaviour differs from contract; file issue |
| **PRODUCT GAP** | Known missing capability; not a regression |
| **BLOCKED** | Cannot proceed (environment, data, permissions) |

## References

- `docs/development/qa-tenant.md`
- `docs/qa/hosted-tenant-replacement-runbook.md`
- `docs/development/site-security-boundary.md`
- `tests/integration/cookieworks-two-site-hostile.test.ts`
- `tests/e2e/cookieworks-two-site-hostile.spec.ts`
