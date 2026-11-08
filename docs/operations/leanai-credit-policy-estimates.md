# LeanAI credit policy estimates (Nov 2026)

Status: **candidate policy defaults — not customer-promised quotas, not verified profitability**

## Evidence boundaries

- Hosted telemetry to date (65 runs, 49 completed) is **test-heavy and not representative** of Cornwall production sites (120–1,000 employees, multi-site).
- Internal rate-card rows marked **illustration** must not be relabelled **verified** until each model id and USD rate is reconciled with [OpenAI pricing](https://platform.openai.com/docs/pricing) (input, cached input, output, reasoning, tool rules).
- Supabase costs are **per project**, not per customer site — do not multiply platform free tiers per tenant ([Supabase pricing](https://supabase.com/pricing)). Netlify and other hosting sit outside gross-margin maths here.

## Illustrative adoption (not market research)

| Scenario | Assumption | Indicative runs/mo (1,000-employee site) |
| --- | --- | ---: |
| Low | 10% employees × 5 runs/mo | 500 |
| Base | 20% × 15 | 3,000 |
| High | 35% × 40 | 14,000 |

Uncapped high adoption on Essentials (£499/site) can exceed subscription revenue — **internal safeguards required before hard enforcement**.

## Candidate configurable budgets (pending activation)

| Plan | Illustrative internal provider budget / site / month | Candidate credits / site / month (1 credit = £0.001) |
| --- | ---: | ---: |
| Essentials | £30 | 30,000 |
| Professional / Founder | £120 | 120,000 |

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
