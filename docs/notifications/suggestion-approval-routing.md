# Suggestion approval routing and delegation

## Behaviour summary

- **Draft** suggestions do not emit manager approval notifications.
- On **submit** (`draft` → `submitted`), eligible approvers are resolved from `review_jurisdiction_unit_id` only (not origin-unit fallbacks that could widen scope).
- Eligible approvers are active memberships with scoped `suggestions.review` or scoped `suggestions.manage` for the jurisdiction (via `unit_subtree` / `organisation` grants).
- **Multiple eligible approvers:** each receives in-app + email; `suggestion_approval_routing.pending_approver_membership_id` stores the deterministic primary (sort: review before manage, then `membership_id`).
- **No eligible approvers:** routing records `routing_basis = none`; no approval emails; operators should assign a reviewer manually.
- **Delegation:** `delegate_suggestion_approval` records audit, revokes the prior approver's pending in-app item, assigns `delegated` reviewer, and enqueues email via `SuggestionReviewerReassigned`.

## Mail configuration prerequisites

Operational email delivery reuses the existing notification worker (`notification-projector` → `notification-delivery`). For suggestion approval email to leave the ledger:

1. Local/staging: Supabase stack with notification workers enabled; Mailpit/Inbucket at `MAILPIT_URL` for capture only.
2. Recipient must resolve to `deliverable` in `get_notification_delivery_context` (active membership, workforce contact or confirmed auth email).
3. `NOTIFICATION_DELIVERY_*` / provider env vars configured for the delivery worker in hosted environments (same as other operational kinds — do not add a parallel transport).
4. Mandatory workflow notifications are not suppressible via per-user channel prefs today; if product adds opt-outs later, `suggestions.awaiting_review` should remain on the mandatory allowlist.
