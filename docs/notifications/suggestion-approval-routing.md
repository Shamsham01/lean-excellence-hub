# Suggestion approval routing and delegation

## Behaviour summary

- **Draft** suggestions do not emit manager approval notifications.
- On **submit** (`draft` → `submitted`), the system snapshots approval routing **once** in `suggestion_approval_routing`:
  - **`primary_approver_membership_id`** — immutable primary chosen at submit (most specific jurisdiction scope).
  - **`task_owner_membership_id`** — current actionable task owner (updated by claim, assign, delegation, end assignment).
  - **`email_recipient_membership_id`** — in-app and email recipient at submit (not recomputed while `submitted` / parked lifecycle uses the snapshot).
  - **`notification_generation`** — versioned in-app dedupe key suffix (`suggestion:{id}:approval:v{n}`).
- Eligible approvers are resolved from `review_jurisdiction_unit_id` only (origin/target unit at submit time; no live re-resolve under review).
- **Single actionable approver:** `private.resolve_suggestion_actionable_approver` picks one membership — prefer `suggestions.review` over `suggestions.manage`, then **tightest** `unit_subtree` depth via `organisation_unit_closure`.
- **No eligible approvers:** routing records `routing_basis = none`; no approval emails; assign reviewer manually.
- **Submit author/submitter** does not receive `suggestions.awaiting_review` (they still receive `suggestions.status_submitted`).
- **Delegation** (`delegate_suggestion_approval`): auditable row, idempotency key, bumps `notification_generation`, revokes superseded in-app tasks, syncs `task_owner`, enqueues `SuggestionReviewerReassigned`. Primary approver is **not** rewritten on delegate or claim.
- **Who may delegate:** active reviewer on the suggestion, **or** primary approver when there is no active reviewer, **or** explicit **manager override** (`suggestions.manage` scoped to jurisdiction — documented intentional elevation; not implied by merely being primary after someone else claimed).

## Security

- New `SECURITY DEFINER` helpers in `private` are owned by `lean_hub_private_owner`, `search_path = ''`, and **`EXECUTE` is revoked** from `PUBLIC`, `anon`, `authenticated`, and `service_role` unless explicitly granted.
- Worker-only public RPC: `lookup_suggestion_approval_notification_recipients_for_worker` — **`service_role` + `postgres` only**; reads snapshotted `email_recipient_membership_id` for `submitted` suggestions and enforces organisation id match on the suggestion row.

## Mail configuration prerequisites

Operational email uses the existing notification pipeline (`notification-projector` → domain event ledger → `notification-delivery` worker).

1. **Local/staging:** Supabase stack with notification workers; capture with Mailpit/Inbucket (`MAILPIT_URL`). **Queued ledger rows are not delivery** — prove capture in Mailpit or delivery receipts, not only outbox/projector success.
2. Recipient must resolve `deliverable` in `get_notification_delivery_context` (active membership, workforce contact or confirmed auth email, and routing snapshot membership for `suggestions.awaiting_review`).
3. Hosted: configure `NOTIFICATION_DELIVERY_*` / provider env for the delivery worker (same transport as other operational kinds).
4. Mandatory workflow notifications remain non-suppressible via channel prefs; keep `suggestions.awaiting_review` on any future mandatory allowlist.

## Verification

- pgTAP: `suggestion_approval_routing_delegation.test.sql`, `suggestion_approval_routing_security.test.sql`, `in_app_notification_emitters_slice341.test.sql`.
- Integration: `npm run test:db:integration:n1b` (projector + worker recipient lookup).
- UI: delegate control only lists eligible reviewers from `get_suggestion_review_context`.
