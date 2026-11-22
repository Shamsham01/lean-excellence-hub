# Problem Solving (PPS) — Flagship workspace redesign

## Goals

- Feel like a premium operational SaaS (Linear / Notion / Vercel calibre): calm hierarchy, crisp surfaces, minimal permanent copy.
- Make **Lean AI the primary way to progress** — copilot is always visible, context-aware, and proposal-driven.
- **One stage at a time** in the centre canvas; no page-level uneven scrolling on desktop.

## Information architecture

| Zone | Role |
|------|------|
| Sticky case header | Identity, status, compact metadata, History + Activity triggers, lifecycle actions |
| Left — stage navigator | Vertical list; green = complete, amber = current / in progress, neutral = upcoming |
| Centre — stage canvas | Active stage fields only; stage title + info tooltip for guidance |
| Right — Lean AI copilot | Full-height dock; messages scroll; composer pinned; collapsible |

Mobile: stage navigator becomes horizontal strip; copilot opens as **bottom sheet**.

Removed from primary UI: **Sessions**, workshop mode, always-visible guidance cards, product FAQ column, duplicate stage grids.

Merged: **Discussion** → **Activity** drawer (comments + lightweight notes).

Discreet: **Status**, **Stage**, and **Method version** history → **History** popover from header.

## Interaction model

1. User opens case → copilot greets with stage context and one targeted question.
2. User answers in chat → facilitator proposes structured changes (existing proposal RPCs).
3. **Pending proposals** render as highlighted cards **inline in the canvas** (Accept / Edit / Reject).
4. Human accepts → records written; canvas refreshes.
5. Copilot suggests **next best step** (advance stage, fill gap, link action).

Stage navigator **selects view**; advancing current stage remains a deliberate facilitator action (header control when viewing another stage).

## Visual language

### Light

- App chrome: `--surface` light neutral grey; sidebar slightly darker than canvas.
- Canvas: white (`--card` / `--elevated`), 1px `--border`, soft shadow on copilot only.
- Accent: existing LEH cobalt primary; semantic green / amber for stage states only.
- No warm / pink paper casts on platform (marketing tokens stay scoped).

### Dark

- Graphite stack matching platform dark tokens; same spacing and radii as light.

### Typography & spacing

- Stage title: `text-lg font-semibold tracking-tight`
- Body: `text-sm`; metadata `text-xs text-muted-foreground`
- Section gaps: 24px canvas; 12px within forms
- Radius: `rounded-lg` controls, `rounded-xl` copilot shell

### Accessibility

- WCAG AA contrast on text and stage state colours.
- Focus rings on all interactive elements; keyboard path for drawers and copilot.

## Methods catalogue

Keep **A3 / 8-Step** and **8 Steps (PPS)** provisioning; add **Rapid Improvement** (~4 steps):

1. Problem (`DEFINE`)
2. Cause — 5 Why (`ROOT_CAUSE_ANALYSIS`)
3. Fix (`COUNTERMEASURES`)
4. Check (`EFFECTIVENESS_CHECK`)

Seeded via migration extending built-in provisioning (`rapid_improvement`); **not applied on hosted** until migration is run.

## Mockups

Static HTML references (light/dark, desktop/mobile):

- `/opt/cursor/artifacts/mockups/pps-flagship-light-desktop.html`
- `/opt/cursor/artifacts/mockups/pps-flagship-dark-desktop.html`
- `/opt/cursor/artifacts/mockups/pps-flagship-light-mobile.html`
- `/opt/cursor/artifacts/mockups/pps-flagship-dark-mobile.html`

## Test IDs (stable)

- `problem-solving-workspace`, `pps-stage-rail`, `pps-stage-{semantic_key}`
- `pps-stage-canvas`, `pps-lean-ai-copilot`, `lean-ai-panel`, `lean-ai-input`, `lean-ai-send`
- `pps-history-trigger`, `pps-activity-trigger`, `pps-inline-proposals`
