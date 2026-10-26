# LeanAI model migration

`gpt-4.1-nano` was retired from the OpenAI API on 23 October 2026. Explain and
follow-up calls used that id as the economy default, so hosted LeanAI returned
`404 The model gpt-4.1-nano has been deprecated.`

This release changes the code defaults. A deployment that still sets the old
ids in the environment keeps sending them until those variables change and the
site is deployed again. Retired ids are rejected before the provider call.
LeanAI does not substitute a more expensive model.

Checked against the OpenAI API docs on 26 October 2026:

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/deprecations
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/pricing

These are API model ids, not ChatGPT product names.

## Model mapping

| Role | Environment variable | Default API id |
| --- | --- | --- |
| Economy (explain, follow-up) | `AI_MODEL_ECONOMY` | `gpt-6-luna` |
| Standard (workspace coach, 5S/Gemba setup, maturity builder) | `AI_MODEL_STANDARD` | `gpt-6.1-terra` |
| Deep | `AI_MODEL_DEEP` | `gpt-6.1-sol` |
| Problem Solving | `AI_MODEL_DEFAULT` | `gpt-6.1-sol` |

`AI_MODEL_STANDARD` does not fall back to `AI_MODEL_DEFAULT`. That variable is
the Problem Solving model. Reusing it would send ordinary coaching to Sol.

`gpt-4.1` and `gpt-4.1-mini` are scheduled to shut down on 14 January 2027.
They are not a rollback target.

## Netlify environment

Set these server-only variables. Do not prefix them with `NEXT_PUBLIC_`.

```env
AI_MODEL_ECONOMY=gpt-6-luna
AI_MODEL_STANDARD=gpt-6.1-terra
AI_MODEL_DEEP=gpt-6.1-sol
AI_MODEL_DEFAULT=gpt-6.1-sol
```

Also:

- Remove `AI_MODEL_REASONING` unless an operator override is intentional.
  When set, it replaces every workflow default. It does not change the model.
- Remove `AI_MAX_OUTPUT_TOKENS`, or set it to at least `10000`. A leftover
  `6000` caps maturity and Problem Solving below their reasoning-inclusive
  budgets and can truncate strict JSON. The variable can only lower a workflow
  budget. It cannot raise it past that budget and it cannot select a model.
- Keep `OPENAI_API_KEY` on the project that is allowed to call all three ids.
- Keep `store` behaviour as implemented. Do not set a provider storage flag.

The owner applies the variables and publishes the deploy. This repository
change does not publish production.

Code defaults apply only when the matching variable is unset. A new build and
deploy is required before either the code or the Netlify values reach the
hosted application.

## API project access

The key's OpenAI project must be entitled to `gpt-6-luna`, `gpt-6.1-terra`,
and `gpt-6.1-sol` on the Responses API, including structured outputs, function
tools, and `web_search`. A 403 with category `model_access_denied` means the
id is known and the project cannot use it. A 404 with category
`model_unavailable` means the id is unknown or retired.

## Reasoning

| Workflow | Model | Default effort | Output budget |
| --- | --- | --- | --- |
| Explain page or module | Luna | `none` | 1,500 |
| Follow-up explanation | Luna | `none` | 1,500 |
| Workspace assistance | Terra | `low` | 3,000 |
| 5S and Gemba setup | Terra | `low` | 5,500 |
| Maturity framework builder | Terra | `medium` | 10,000 |
| Problem Solving | Sol | `medium` | 10,000 |
| Problem Solving challenge mode | Sol | `high` | 14,000 |

Follow-up stays on `none` so the 1,500 token coach cap is not spent on
reasoning. Luna and Sol default to `medium` when effort is omitted, so the
request sends `none` explicitly.

Precedence:

1. Workflow default above.
2. `AI_MODEL_REASONING`, when set, replaces that default for every workflow.
3. Compatibility. Sol and Astra reject `none`. That value is rewritten to
   `low` and recorded as `reasoning_adjusted_from` on the run manifest. The
   model id is unchanged. Unknown remapped ids are sent as configured; a 400
   is returned as `unsupported_request` and is not retried on another model.
4. `AI_MAX_OUTPUT_TOKENS`, when set, lowers the budget only.

Reasoning tokens count against `max_output_tokens`. The budgets above are the
visible allowance plus a reserve (`none` 0, `low` 1,500, `medium` 4,000,
`high` 8,000), capped at 16,000. Challenge mode is the explicit high-effort
path. An operator override still wins over challenge mode, then compatibility
runs.

## Validate a model

1. Confirm the id on the OpenAI models page.
2. Deploy with the variables above.
3. Open LeanAI on a module page and ask what to do on that screen.
4. Confirm the reply is a normal coach answer, not a provider 404.
5. In `ai_usage_events` for that organisation, confirm the explain row uses
   `gpt-6-luna` and that input, output, cached, and reasoning counts were
   stored. Problem Solving rows should use `gpt-6.1-sol`.

Server logs under `[lean-ai:provider]` include the model, HTTP status, provider
error code, and `x-request-id` when the provider sent one. They do not include
the API key or the prompt.

| Symptom | Meaning | Action |
| --- | --- | --- |
| `model_unavailable` / HTTP 404 | Retired or unknown id | Set a supported id and redeploy. Do not expect an automatic fallback. |
| `model_access_denied` / HTTP 403 | Project cannot call that id | Enable the model on the API project, or choose an entitled id. |
| `unsupported_request` and `reasoning.effort` | Effort rejected | Unset `AI_MODEL_REASONING`, or set `low` or higher for Sol. |
| `unsupported_request` and structured output | Schema rejected | Do not loosen strict JSON. Confirm the model supports structured outputs. |
| `timeout` / incomplete `max_output_tokens` | Budget or the 45s limit | Narrow the request, or raise a too-low `AI_MAX_OUTPUT_TOKENS`. |
| `rate_limited` / `provider_unavailable` | Transient provider failure | Retry. The run is finalised with `fail_ai_run`. |

## Cost illustration

List prices below are standard short-context rates (at or under 272K input
tokens) from the model pages on 26 October 2026. They are not measured LEH
usage. The ledger stores actual input, output, cached, and reasoning token
counts. Cached input is billed only for tokens the provider reports. This
release does not enable provider conversation storage and does not add a prompt
cache key. `store` stays `false`, and `previous_response_id` is not sent.

| Model | Input | Cached input | Output |
| --- | --- | --- | --- |
| `gpt-6-luna` | $0.10 / 1M | $0.01 / 1M | $0.50 / 1M |
| `gpt-6.1-terra` | $1.00 / 1M | $0.05 / 1M | $5.00 / 1M |
| `gpt-6.1-sol` | $2.00 / 1M | $0.10 / 1M | $10.00 / 1M |

Web search, when the organisation has opted in, is $10 per 1,000 calls
($0.01 per call) plus search-content tokens at the model input rate. Problem
Solving does not offer web search.

Assumptions: uncached input, short context, standard processing, no regional
premium. Output figures include reasoning tokens.

| Workflow | Assumed tokens | Illustrative cost |
| --- | --- | --- |
| Short explanation (Luna, `none`) | 2,500 in + 400 out | $0.00045 |
| One workspace turn (Terra, `low`) | 6,000 in + 1,300 out (800 reasoning) | $0.0125 |
| Maturity draft (Terra, `medium`) | 8,000 in + 6,000 out (3,500 reasoning) | $0.038 |
| Problem Solving turn, two model calls (Sol, `medium`) | 17,000 in + 5,850 out | $0.0925 |
| One web-search call on Terra | $0.01 tool + about 2,000 input tokens | about $0.012 extra |

Explain stays in the same cost band as `gpt-4.1-nano` ($0.10 / $0.40). Terra
is roughly three times the old mini rate at these volumes. Sol is the
intentional Problem Solving upgrade from mini and is several times that rate.
It is not used for explain.

## Remap and rollback

Set `AI_MODEL_ECONOMY`, `AI_MODEL_STANDARD`, `AI_MODEL_DEEP`, or
`AI_MODEL_DEFAULT` to another id the API project can call, then redeploy.
Unsetting all four returns to the defaults in the table above.

Do not roll back to `gpt-4.1-nano`, `gpt-4.1-mini`, or `gpt-4.1`. Nano is
already rejected. Mini and `gpt-4.1` shut down on 14 January 2027.

There is no automatic fallback to a larger model. A fallback would be a
separate, explicitly approved change.
