# Local demo seed (development only)

The demo seed creates a repeatable **local-only** tenant for exercising Milestone 4
platform capabilities. It uses approved Milestone 3 provisioning, hierarchy, RBAC,
and invitation flows — it does not bypass security invariants.

## Safety guards

`npm run db:seed-demo` refuses to run unless **all** of the following are true:

- Invoked via the `db:seed-demo` npm script (or `LEANHUB_ALLOW_DEMO_SEED=1`)
- `NODE_ENV` is not `production`
- `supabase status -o env` reports a local API URL (`127.0.0.1:54321` or `localhost:54321`)
- The API URL is not a hosted `*.supabase.co` project
- No linked Supabase project file exists at `.supabase/linked-project`
- `DATABASE_URL` / `SUPABASE_DB_URL` do not target hosted Supabase

Credentials are read from the **local Docker stack** via `supabase status`, not from
`.env.local`, so a misconfigured remote URL cannot accidentally receive demo data.

## Prerequisites

```powershell
npm ci
npm run db:start
npm run db:reset
```

## Run the seed

```powershell
npm run db:seed-demo
```

The command is idempotent: re-running updates demo passwords and ensures hierarchy,
roles, memberships, and minimal platform samples exist.

## Demo organisation

| Field | Value |
| --- | --- |
| Name | Apex Manufacturing |
| Code | `apex-manufacturing` |

### Hierarchy

```text
Cornwall Plant
├── Operations
├── Engineering
└── Quality
```

## Demo users (development passwords only)

| User | Email | Password | Access |
| --- | --- | --- | --- |
| Organisation Owner / Admin | `admin@apex.local` | `Admin@Apex-Dev-2026!` | Full owner role; all Milestone 4 platform pages |
| Plant Manager | `manager@apex.local` | `Manager@Apex-Dev-2026!` | Unit-scoped manager role for Cornwall Plant subtree |
| Line Operator | `operator@apex.local` | `Operator@Apex-Dev-2026!` | Basic self-scoped member permissions |

Never use these credentials outside local development.

## Expected routes (admin)

After signing in at `/login`, the admin account should reach:

| Route | Purpose |
| --- | --- |
| `/platform` | Authenticated platform shell (organisation context + nav) |
| `/platform/actions` | Universal actions list/create |
| `/platform/templates` | Template management |

## Minimal Milestone 4 sample data

The seed creates only:

- One demonstration action: **Review Cornwall line clearance checklist**
- One published template: **Line clearance checklist**

It does **not** seed Lean Maturity, 5S, Gemba, Projects, Suggestions, or other future
domain modules.

## Reset the local demo database

To return to a clean local database and re-seed:

```powershell
npm run db:reset
npm run db:seed-demo
```

`db:reset` reapplies migrations only. Always run `db:seed-demo` afterwards when you
need the Apex demo tenant.

## Verify with Playwright

With local Supabase running and the seed applied:

```powershell
$env:E2E_WITH_SUPABASE = "1"
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
# Set publishable + service keys from: npx supabase status -o env
npm run test:e2e -- tests/e2e/demo-seed.spec.ts
```

Or run the database CI job pattern, which seeds implicitly via the dedicated demo
shell smoke test when configured.
