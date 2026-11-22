# LeanAI internal cost governance

Status: slice 2 implemented (issue #316). Slice 3 site attribution beyond authoritative session site remains deferred.
Decision date: 4 November 2026.
Customer slice: Settings → LeanAI describes included access and optional governance. It does not estimate provider cost.

This note is the contract for the next slice. It does not authorise customer overage invoices, automatic shutdowns, or a change to `start_ai_run`.

## What the first slice found

1. Settings used to lead with a raw monthly token ceiling and a placeholder that looked like a plan quota. The ceiling is now under Advanced governance. The default remains unset.
2. Web-search help text used to imply a customer usage charge. Public web research does not add a subscription charge. Provider cost stays internal.
3. `leanAiMonthlyTokenAllowance` in the plan catalogue is metadata: 500,000 for Essentials, 2,000,000 for Professional and Founder Pilot, and null for Enterprise. `start_ai_run` does not read those numbers. Eligibility withholds LeanAI only when the resolved allowance is `0` and a plan code exists. Enterprise null is included access, not an unlimited promise. Customer copy must not publish those figures as quotas.
4. The customer headline total is input plus output. `private.organisation_ai_monthly_token_usage` adds input, cached input, output, and reasoning. Cached input is a subset of input and reasoning is a subset of output, so the pause meter double-counts. The settings page explains that when a ceiling is set. Do not change the SQL sum in a way that silently loosens or tightens an existing ceiling.
5. `update_organisation_ai_settings` defaults `target_monthly_token_ceiling` to null and writes that value. Omitting the argument clears a configured ceiling. The settings action now always sends the intended value, including null when an administrator turns the pause off. The demo seed reads the current ceiling and sends it back when it enables LeanAI.
6. `organisationHasEntitlement` treats a null number as false. LeanAI inclusion does not. Do not use that helper to decide whether LeanAI is included.

## Customer boundary

Customers see included access, fair use, month-to-date interactions, token distinctions, and optional governance. They do not see OpenAI prices, margins, profitability, other tenants, or an internal alert.

There is no token overage invoice. Reasonable fair use applies. The normal customer experience does not demand a monthly token ceiling.

The organisation is the shared usage and governance boundary. Site quantity scales the subscription. There is no per-user price and no hard quota per site.

## Second slice

### Versioned model pricing

Keep a versioned internal rate card, with an effective date and a source, separate from customer copy. The 26 October 2026 figures in [LEANAI-MODEL-MIGRATION](../operations/LEANAI-MODEL-MIGRATION.md) are an illustration, not the live rate card:

| Model | Input | Cached input | Output |
| --- | --- | --- | --- |
| `gpt-6-luna` | $0.10 / 1M | $0.01 / 1M | $0.50 / 1M |
| `gpt-6.1-terra` | $1.00 / 1M | $0.05 / 1M | $5.00 / 1M |
| `gpt-6.1-sol` | $2.00 / 1M | $0.10 / 1M | $10.00 / 1M |

Replace those rates only by adding a new dated version. Do not edit history. Estimates are USD planning figures, not invoices.

An unknown model, a missing token count, or a rate card that does not cover the usage date is **unpriced / incomplete estimate**. It is not zero.

### Token arithmetic

For a priced estimate:

- Bill input at the input rate, then subtract the cached subset and bill that subset at the cached rate.
- Bill output at the output rate. Reasoning is already inside output. Do not add it again.
- Do not use the pause-meter sum for cost. That sum double-counts cached input and reasoning.

### Web search

Web search is optional and off by default. When it is used, add the tool fee from the same rate-card version (the October 2026 illustration was $10 per 1,000 calls) plus the search-content tokens at the model input rate. A run with no web-search count contributes no tool fee. A missing count on a run that claims web search was used is an incomplete estimate.

### Attribution

Attribute each estimate to:

- organisation, from the usage event
- workflow, from the existing run or session record
- trusted site, only from the authoritative record, workspace, or session context

Do not use the member's primary site. Do not accept a site id from the client or the model. If the authoritative context has no site, leave site attribution empty. Do not invent one.

### Soft cost alert

Compare the organisation's estimated provider cost for the period with that organisation's subscription revenue for the same period. The first internal review point is about 5% of subscription revenue.

The alert is internal. It does not email the customer, create a charge, or stop LeanAI. An incomplete estimate does not count as under the 5% line. Cross-customer benchmarks are out of scope.

### What this slice must not do

- No automatic customer charge.
- No new hard quota taken from the catalogue.
- No shutdown when the soft alert trips.
- No service-role shortcut in customer RPCs.
- No customer-visible margin or provider price.
- No change to the 30 runs / 5 minutes membership rate limit.
- No change to permission `ai.manage_settings` or organisation isolation.

### Acceptance to write with the implementation

- A known model with cached and reasoning tokens prices cached as a subset of input and reasoning as a subset of output.
- An unknown model, or a usage row with missing metering, is unpriced / incomplete, not zero.
- Web search adds a tool fee only when the usage event records it.
- Site attribution follows the session or record, including the case where no site is known.
- The 5% comparison is an internal signal and does not call billing or `start_ai_run`.
- Customer settings still omit provider prices after the estimator exists.

### Follow-ups already deferred

- Optional customer notification when an administrator's own ceiling is reached, only through an existing notification path.
- Replacing the pause-meter sum so it stops double-counting, as its own migration, with an explicit decision about organisations that already configured a ceiling.
- Making `update_organisation_ai_settings` preserve a ceiling when the argument is omitted, if a later migration can do that without surprising current callers that pass null to clear it.
