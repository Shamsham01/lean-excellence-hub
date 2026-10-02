# LeanAI intervention engine and coach UI (LEANAI-CONTEXT-03)

Status: **Implemented**

Date: **2026-09-30**

This slice sits on top of [semantic context and setup readiness](./leanai-semantic-context-and-readiness.md). It does **not** redesign that foundation.

Pipeline: **readiness/context → typed intervention catalogue → permission and cooldown filter → one LeanAI Coach CTA**.

Normal selection and rendering make **zero model/provider calls** and work when `AI_ENABLED=0`.

## Catalogue

Stable keys in `src/modules/leanai-context/interventions/catalogue.ts`:

| Key | Readiness | Permission | Priority |
| --- | --- | --- | --- |
| `organisation_onboarding_continue` | organisation incomplete during pre-workspace onboarding | `billing.manage` | 5 |
| `organisation_profile_setup` | organisation incomplete/blocked outside onboarding | `billing.manage` | 10 |
| `sites_first_setup` | sites not_started/incomplete | `hierarchy.manage` | 20 |
| `people_job_functions_setup` | people not_started/incomplete | `job_functions.manage` | 30 |
| `maturity_first_setup` | maturity not_started/incomplete | `maturity.models.manage` | 40 |
| `suggestions_programme_setup` | suggestions not_started/incomplete | `suggestions.programmes.manage` | 50 |
| `five_s_standard_setup` | five_s not_started/incomplete | `five_s.standards.manage` | 60 |
| `gemba_definition_setup` | gemba not_started/incomplete | `gemba.definitions.manage` | 70 |
| `training_curriculum_setup` | training not_started/incomplete | `training.curriculum.manage` | 80 |
| `skills_capability_setup` | skills not_started/incomplete | `skills.requirements.manage` | 90 |
| `recognition_types_setup` | recognition not_started/incomplete | `recognition.manage` | 100 |
| `lean_ai_enablement_setup` | lean_ai not_started/incomplete | `ai.manage_settings` | 110 |

Copy, routes and explain text are static product strings.

## Ranking

1. Ignore the catalogue when `proactive_assistance_enabled` is false.
2. Keep interventions whose surface includes the current page.
3. Keep only matching readiness statuses. `ready` never qualifies. Hard-blocked modules (5S/Gemba/Recognition waiting on sites) stay out because they are not eligible until unblocked.
4. Keep only interventions where **every** required permission is true for the current membership.
5. Drop snoozed or dismissed keys for the current membership and organisation.
6. Sort by catalogue priority (setup order). Return one primary recommendation. Dismissing or snoozing the primary key can surface the next eligible gap on a later load; the same key does not nag during its cooldown.

## Dismissal / snooze

Uses existing `leanai_intervention_states` current-state rows. No employee counts.

- **Later** records `leanai.intervention_dismissed`. That key is hidden for 168 hours. The next eligible recommendation may appear after reload.
- **Snooze** records `leanai.intervention_snoozed` with `snooze_minutes = 1440`. That key is hidden until `snoozed_until`.
- **Set it up** records `leanai.intervention_accepted` and navigates.
- **Explain** expands deterministic copy by default (zero model cost). When
  application AI, organisation AI, `ai.use`, subscription access and usage
  limits all pass, an explicit Explain click may enrich the answer through a
  general Coach AI session (ADR-0018). Deterministic copy remains the fallback.
  The UI labels **Setup guidance** versus **AI-generated guidance** and may
  offer a bounded follow-up. No AI call on mount, ranking, Later, or Snooze.
- Mount records `leanai.intervention_shown` once per browser session.

State is membership + organisation scoped, so the same person in two organisations has separate cooldowns.

## Surfaces

- `/onboarding/setup` — uses a dedicated pre-workspace onboarding intervention because normal `/platform/*` setup routes are intentionally unavailable until onboarding is completed. The inline `LeanAiCoach` card remains here.
- `/platform/*` — the persistent LeanAI assistant pane in `PlatformShell` (docked desktop, sheet/drawer on smaller viewports). Deterministic interventions render inside the pane instead of duplicating a Coach card on the page.
- `/platform/setup`
- `/platform` (home)
- Maturity empty/setup and framework authoring, including `?step=` changes
- Suggestions overview and `/platform/suggestions/programmes`

The reusable components are `LeanAiAssistantPanel` (workspace) and `LeanAiCoach` / `LeanAiCoachCard` (onboarding and intervention CTA inside the pane).


## Security

No new SECURITY DEFINER functions. The snapshot RPC gained one boolean field. The site FK covering index is additive.

Do not record clickstream. Do not score employees. Do not send organisation IDs from the browser.
