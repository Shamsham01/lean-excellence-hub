# LeanAI superpowers runbook

First slice: Problem Solving product knowledge and authorised historical search.

## Migration

File: `supabase/migrations/20261104001725_authorised_problem_solving_history.sql`

Forward only. It replaces `public.search_similar_problem_solving_cases` and adds `public.search_authorised_problem_solving_history`.

Apply it on the target database before deploying an application build that calls the new function. An older application keeps working against this database: the similar-case function still accepts `(uuid, integer)` and returns JSON. New keys are additive. The numeric `rank` field is no longer returned.

Search recall is lexical. Three or fewer content words must all appear in the closed case. Longer text matches when at least three content words overlap. A shorter historical case can therefore be found from a longer description. A case that shares only one or two words, or none of the same words, is still omitted. Do not lower that floor to improve recall: a single common word would surface unrelated readable cases. This does not change `can_read_problem_solving_case`.

The search functions are `SECURITY DEFINER` and must remain owned by the migration role. That role bypasses `FORCE RLS`, so the body filters with `can_read` before returning titles or verified-cause snippets. Do not change the owner to `lean_hub_private_owner`.

Do not apply this file to hosted Supabase unless the owner has approved that migration. Local Supabase is the intended test target.

There is no data backfill and no customer reset.

## Grants

- `authenticated` can execute both public functions.
- `anon` and `service_role` cannot.
- `authenticated` cannot execute `private.authorised_closed_problem_solving_matches`.

The functions use the caller's session organisation. They do not take an organisation id.

## Application

No new environment variable. Product knowledge version `2026-11-04` is compiled into the server and the related-work panel.

Historical search and the product-guidance buttons do not call the model provider. The facilitator still requires the existing `AI_ENABLED` gate and `ai.use`.

Case creation, activation, and closure do not depend on the provider.

## Smoke test after the migration is on the target database

1. Sign in as a member who can create and read problem-solving cases.
2. Open `/platform/problem-solving/new`. Confirm Find related work runs without a model and that Create stays available when a match appears, and when the search finds nothing.
3. Open a closed case you can read and use Find related work on the LeanAI tab. Open View related work and confirm the case page loads.
4. Sign in as a member whose problem-solving view is limited to one site. Repeat the search and confirm a closed case on another site is absent, with no message that hidden cases exist.
5. Disable LeanAI for the organisation, or use a member without `ai.use`. Confirm the related-work search and the product-guidance buttons still answer, and that the facilitator input explains that conversation is unavailable.

## Rollback

The migration is forward only. Rolling back the application without the migration is safe for older builds. Rolling back the migration after the new application is deployed removes `search_authorised_problem_solving_history` and the new case-creation search returns an error until the application is rolled back too. Do not delete customer cases as a rollback step.
