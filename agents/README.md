# Lean Excellence Hub — agent organisation

Version-controlled **definitions** for how specialised agents support LEH delivery. This folder does not execute agents by itself; it is the registry humans and orchestrators (ATLAS) use to assign work.

## Activation honesty

| Agent | Code | Status | Notes |
| --- | --- | --- | --- |
| **ATLAS** | `ATLAS` | **Live** | The founder's **Grok Bot** orchestrator on Cursor / Agent SDK. Routes work, enforces gates, does not bypass human approval for production. |
| **KAIZEN** | `KAIZEN` | **Live** | A **Grok Bot teammate** (operational excellence / Lean Six Sigma MBB domain). Engaged for OpEx framing, DMAIC/A3 coaching copy, and sustainment language. |
| FORGE | `FORGE` | Definition only | Activated on demand for architecture / ADR work. |
| NEXUS | `NEXUS` | Definition only | Activated on demand for LeanAI runtime and integration. |
| SENTINEL | `SENTINEL` | Definition only | Activated on demand for Supabase, RLS, and security reviews. |
| PULSE | `PULSE` | Definition only | Activated on demand for reliability, incidents, deploy SHA alignment. |
| VERIFY | `VERIFY` | Definition only | Activated on demand for QA automation and release evidence. |
| PIXEL | `PIXEL` | Definition only | Activated on demand for UX, UI, and accessibility. |
| TALENT | `TALENT` | Definition only | Activated on demand for Skills, training, and recognition flows. |
| CONNECT | `CONNECT` | Definition only | Activated on demand for workflow automation and collaboration. |
| LAUNCH | `LAUNCH` | Definition only | Activated on demand for SaaS commercialisation and production readiness. |

## Profile index

| Agent | Role | Profile | Avatar |
| --- | --- | --- | --- |
| ATLAS | Chief Orchestrator | [profiles/atlas.md](./profiles/atlas.md) | [avatars/atlas.svg](./avatars/atlas.svg) |
| FORGE | Principal Software Architect | [profiles/forge.md](./profiles/forge.md) | [avatars/forge.svg](./avatars/forge.svg) |
| NEXUS | LeanAI Runtime & Integration | [profiles/nexus.md](./profiles/nexus.md) | [avatars/nexus.svg](./avatars/nexus.svg) |
| SENTINEL | Supabase DB & Security | [profiles/sentinel.md](./profiles/sentinel.md) | [avatars/sentinel.svg](./avatars/sentinel.svg) |
| PULSE | Production Reliability & Incident | [profiles/pulse.md](./profiles/pulse.md) | [avatars/pulse.svg](./avatars/pulse.svg) |
| VERIFY | QA Automation & Release | [profiles/verify.md](./profiles/verify.md) | [avatars/verify.svg](./avatars/verify.svg) |
| KAIZEN | Operational Excellence (MBB) | [profiles/kaizen.md](./profiles/kaizen.md) | [avatars/kaizen.svg](./avatars/kaizen.svg) |
| PIXEL | UX/UI & Accessibility | [profiles/pixel.md](./profiles/pixel.md) | [avatars/pixel.svg](./avatars/pixel.svg) |
| TALENT | Skills, Training & Recognition | [profiles/talent.md](./profiles/talent.md) | [avatars/talent.svg](./avatars/talent.svg) |
| CONNECT | Workflow Automation & Collaboration | [profiles/connect.md](./profiles/connect.md) | [avatars/connect.svg](./avatars/connect.svg) |
| LAUNCH | SaaS Commercialisation & Production Readiness | [profiles/launch.md](./profiles/launch.md) | [avatars/launch.svg](./avatars/launch.svg) |

## Shared forbidden actions (all agents)

Unless the **platform owner** explicitly approves a scoped exception in writing for a specific task:

- No **production data** reads beyond what is required for a ticket, and never copy customer content into public issues, logs, or docs.
- No **hosted Supabase migrations**, `db push`, or schema changes on production.
- No **git merge**, **production deploy**, or **Netlify publish**.
- No **billing** configuration changes (Stripe live/sandbox secrets, webhooks, prices).
- No **customer communications** (email, in-app messages to tenants).
- No **secret access** or copying credentials into chat; use approved secret stores only with human approval.

Agents may **prepare** migrations, PRs, runbooks, and checklists; humans merge, deploy, and apply hosted changes.

## Avatars

Square **512×512** abstract SVG marks (no logos or characters). Palette per agent is documented in [avatars/README.md](./avatars/README.md).

PNG exports live beside each SVG when generated (`*.png`). Regenerate with:

```bash
node agents/avatars/export-png.mjs
```

Requires Node.js and `sharp` (already a dev dependency of this repository).

## Knowledge and roadmap

Compact, code-grounded indices:

- [docs/knowledge/README.md](../docs/knowledge/README.md)
- [docs/roadmap/MASTER_PLAN.md](../docs/roadmap/MASTER_PLAN.md)
