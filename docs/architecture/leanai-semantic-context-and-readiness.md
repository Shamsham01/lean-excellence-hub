# LeanAI semantic context and setup readiness (LEANAI-CONTEXT-01)

Status: **Implemented foundation**

Date: **2026-09-29**

This slice is the non-LLM foundation for LeanAI contextual assistance (programme #183, docs PR #184, implementation #185). It records bounded semantic product events, keeps a compact journey read-model, and evaluates organisation setup readiness from authoritative domain tables. The programme architecture document lands with PR #184; this file is the implementation record for CONTEXT-01.

Normal operation makes **zero model calls** and works when `AI_ENABLED=0`.

## Product boundary

LeanAI journey context exists solely to:

- improve setup assistance
- avoid repetitive prompts
- provide relevant contextual help

It must not become employee productivity scoring, ranking, disciplinary profiling, time-at-screen measurement, or behavioural performance monitoring. There is no admin report of the form "this person dismissed N prompts". Intervention state stores last-outcome timestamps, not dismissal counts.

Do not record raw DOM clicks, mouse coordinates, hover durations, keystrokes, deleted text, or arbitrary page-dwell surveillance.

Durable business state stays in domain tables. Semantic events are only for things domain tables do not naturally represent (prompt shown/dismissed/snoozed, onboarding step skipped, module opened where it supports later assistance).

## Semantic events

Table `public.leanai_semantic_events`. Bounded keys:

- `onboarding.started`
- `onboarding.step_completed`
- `onboarding.step_skipped`
- `onboarding.completed`
- `module.opened`
- `leanai.intervention_shown`
- `leanai.intervention_accepted`
- `leanai.intervention_dismissed`
- `leanai.intervention_snoozed`

Writes go through `public.record_leanai_semantic_event(...)`. Organisation and membership IDs are derived from `private.current_organisation_id()` / `private.current_membership_id()`. Clients cannot supply a tenant id.

Metadata is a flat JSON object with at most 16 scalar keys, 200-character strings, and an explicit denylist of surveillance/secret field names.

## Journey context

`public.leanai_journey_contexts` is a compact current-state row per `(organisation, membership)`:

- recent setup module
- onboarding step/status
- last intervention key/timestamp

`public.leanai_intervention_states` stores cooldown/dismissal **current state** for the acting membership only.

## Retention

`organisation_ai_settings.journey_event_retention_days` (default 90, range 7–730).

`private.cleanup_expired_leanai_semantic_events(organisation_id)` deletes expired **events** only. It does not delete intervention current-state rows. This slice does not schedule automatic deletion; the cleanup path is safe to invoke later.

## Readiness evaluator

`public.get_organisation_setup_readiness()` (also included in `public.get_leanai_contextual_snapshot()`) returns one server payload for all keys:

`organisation`, `sites`, `people`, `maturity`, `suggestions`, `five_s`, `gemba`, `training`, `skills`, `recognition`, `lean_ai`

Each item: `key`, `status` (`not_started | incomplete | ready | blocked`), `reason`, `reason_code`, `prerequisites`, `recommended_action`, `target_route`, `supporting_metrics`.

Statuses are deterministic SQL against domain tables. Application provider availability is merged in TypeScript via `isApplicationAiProviderAvailable()` and never returns secrets.

### Readiness definitions

| Key | not_started | incomplete | ready | blocked |
| --- | --- | --- | --- | --- |
| organisation | No profile/name | `provisioning` or `onboarding_required` | Active named org with operational access | Suspended/closed/billing non-operational |
| sites | No active units | Units exist but no active billable site | ≥1 active billable site | Waiting on organisation |
| people | No active owner | Owner exists, no active job function | Owner + ≥1 job function. User count is not used. | Waiting on organisation |
| maturity | No framework | Framework exists, none published | ≥1 published version | — |
| suggestions | No programme | Programme exists but not active+published | Active programme with published version | — |
| five_s | No standard | Standard exists but not published with active applicability | Published standard + active applicable unit | Waiting on sites |
| gemba | No definition | Definition exists but not published with active applicability | Published definition + active applicable unit | Waiting on sites |
| training | No catalogue | Course exists without published curriculum requirement | ≥1 published course **and** published curriculum with ≥1 requirement. Catalogue alone is not ready. | Waiting on organisation |
| skills | No scale/skill/set | Partial config | Published scale with ≥1 level + active skill + published capability set with requirements | Waiting on organisation |
| recognition | No types | Types exist but none active | ≥1 active recognition type | Waiting on sites |
| lean_ai | Org `ai_enabled=false` | Enabled but current user lacks `ai.use`, or application provider unavailable | Org enabled + user may use + application available | Waiting on organisation |

### Prerequisite graph

Hard: `sites/people/lean_ai → organisation`; `five_s/gemba/recognition → sites`.

Soft (recommended order, not blocking): `maturity/suggestions → sites`; `training/skills → people`.

## Security

- FORCE RLS on all new tables
- Authenticated SELECT only for **current organisation and current membership**
- No INSERT/UPDATE/DELETE grants to `authenticated` or `anon`
- No anonymous RPC execute
- SECURITY DEFINER helpers use `search_path = ''` and `lean_hub_private_owner`
- Same identity in two organisations cannot read the other organisation's events or readiness

## API

- Server actions: `src/app/(platform)/platform/leanai/context/actions.ts`
- Route handler: `GET/POST /api/leanai/context` (one read-model boundary; POST does not accept organisation IDs)

This slice does not implement the intervention UI. `module.opened` is not globally instrumented on every route.

See [LEANAI-CONTEXT-03](./leanai-intervention-engine.md) for the intervention engine and coach UI that consume this snapshot.
