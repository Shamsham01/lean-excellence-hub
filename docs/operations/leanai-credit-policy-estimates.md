# LeanAI credit policy estimates (Nov 2026)

Status: **candidate policy defaults — not customer-promised quotas, not verified profitability**

## Employees vs billed sites (founder t116u)

- LEH bills **number of sites** in the subscription, not headcount. **Unlimited employees/memberships per site** on every plan — no seat cap, no per-user fee, no plan band by employee count.
- Headcounts below (120, 500, 1,000) appear **only** in illustrative cost scenarios. They are **not** product limits and must not drive onboarding, invites, or enforcement.
- LeanAI candidate credits are a **pooled organisation allowance** scaled by subscribed **site quantity**, never a per-user or per-employee cap.

## Evidence boundaries

- Hosted telemetry to date (65 runs, 49 completed) is **test-heavy and not representative** of Cornwall production sites used only as **illustrative** employee-count scenarios (e.g. 120, 500, 1,000 employees, multi-site).
- Internal rate-card rows marked **illustration** must not be relabelled **verified** until each model id and USD rate is reconciled with [OpenAI pricing](https://platform.openai.com/docs/pricing) (input, cached input, output, reasoning, tool rules).
- Supabase costs are **per project**, not per customer site — do not multiply platform free tiers per tenant ([Supabase pricing](https://supabase.com/pricing)). Netlify and other hosting sit outside gross-margin maths here.

## Illustrative adoption (not market research, not product limits)

These rows model **possible AI usage** for internal cost stress-tests only. Adoption % is not a plan entitlement and does not cap memberships.

| Scenario | Assumption (illustrative) | Indicative runs/mo at **1,000-employee cost scenario** |
| --- | --- | ---: |
| Low | 10% of that headcount × 5 runs/mo | 500 |
| Base | 20% × 15 | 3,000 |
| High | 35% × 40 | 14,000 |

Repeat the same logic for **120-** or **500-employee** scenario sites when modelling margin — still with unlimited actual memberships allowed.

Uncapped high adoption on Essentials (£499/site) can exceed subscription revenue — **internal safeguards required before hard enforcement**.

## Candidate configurable budgets (pending activation)

| Plan | Illustrative internal provider budget / site / month | Candidate **cost-credit** budget / site / month (ledger micro-units; not tokens) |
| --- | ---: | ---: |
| Essentials | £30 | 30,000 cost credits |
| Professional / Founder | £120 | 120,000 cost credits |

`30,000` / `120,000` are **monthly cost-credit pool sizes** aligned to the illustrative £ budgets above (`LEANAI_CREDIT_MICRO_GBP_PER_CREDIT` mapping). They are **not** token allowances and are **not** used as token governance metadata.

Pooled organisation allowance scales by **subscribed site quantity**. `LEH_AI_CREDIT_POLICY_ENFORCED` remains **false** in application code until usage review and verified rate cards.

## Settlement principles (design — implementation partial)

- Reserve maximum admission cost, settle actual usage, idempotent retries.
- Do **not** double-count reasoning inside output or cached inside input when costing.
- LEH-caused failures should refund customer credits while retaining provider-cost ledger rows.
- No automatic top-ups, overage invoices, or storage egress billing to customers.

## Next verification steps

1. Match live router model ids to official price tables.
2. Export 30-day production token histograms per workflow after Essentials launch.
3. Reconcile internal 5% soft alert against verified USD estimates only.
