# TailAdmin-inspired platform design system (LEH)

Reference: [TailAdmin demo](https://demo.tailadmin.com) — applied platform-wide; Problem Solving is the first fully migrated module workspace.

## Mandatory colour tokens

| Token | Light | Dark |
|-------|-------|------|
| Canvas (`--background`) | `#F8FAFC` | `#090E17` |
| Card (`--card`) | `#FFFFFF` | `#121B2A` |
| Border (`--border`) | `#E2E8F0` | `#1E2D42` |
| Success | `#10B981` | `#10B981` |
| Warning / action | `#F59E0B` | `#F59E0B` |
| Critical | `#EF4444` | `#EF4444` |
| Accent / primary | `#465FFF` | `#465FFF` (lighter hover on dark) |

Never use pure `#000` for surfaces or borders in dark mode.

## Typography

- **Sans:** Geist Sans (fallback Inter) — all UI copy.
- **Mono:** Geist Mono — status chips, numeric IDs, dates, percentages (e.g. `ACT-2026-0005`, `64%`).

## Surfaces

- **Card:** `bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden`
- **Buttons:** small, fine border, subtle top highlight, `active:scale-[0.98] transition-all duration-150`
- **Hover:** `hover:bg-accent hover:text-accent-foreground transition-colors duration-150`

## App shell

- Left sidebar: grouped sections, active route = tinted pill, optional **NEW** nav badge.
- Top bar: Cmd+K command palette trigger, theme toggle, notifications, avatar.
- Main canvas uses `--background`; module cards use `--card`.

## Density

- Manager / desktop: compact tables, `min-h-9` controls, tight spacing.
- Shop-floor (audits, walks): keep `min-h-11` touch targets — do not regress gemba/5S audit flows.

## Follow-up screen mockups (implementation in later PRs)

- Home dashboard — `/opt/cursor/artifacts/mockups/platform-home-{light,dark}.html`
- Maturity assessment — `/opt/cursor/artifacts/mockups/platform-maturity-{light,dark}.html`
- Action manager — `/opt/cursor/artifacts/mockups/platform-actions-{light,dark}.html`
