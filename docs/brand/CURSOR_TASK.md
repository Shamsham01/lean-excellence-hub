# Cursor task — BRAND-001

BRAND-002 replaced the white-matte guidance below. Current placement is `docs/product/branding.md`. The horizontal UI files are `leh-horizontal-light.png` and `leh-horizontal-dark.png`. The icon UI files are `leh-icon-light.png` and `leh-icon-dark.png`.

Repository: Shamsham01/lean-excellence-hub
Issue: https://github.com/Shamsham01/lean-excellence-hub/issues/305

Start from latest main, or from an asset-upload branch containing the extracted pack. **Ensure the enclosed `public/brand/*` and `src/app/{favicon.ico,icon.png,apple-icon.png}` files are present in the working tree.** The images are actual files, not links: this ChatGPT ZIP is not directly accessible to Cursor Cloud until extracted/pushed.

**Goal:** Implement official Lean Excellence Hub brand consistently, prioritizing the landing page and webpage tab favicon while preserving UX and security. No other redesign requested.

1. The official assets are in `public/brand/`; originals are preserved in `public/brand/originals/`. Use `leh-horizontal.png` only on a white/light background, with aspect ratio preserved; it has a white matte. Use `leh-icon-blue.png` (transparent outside the blue rounded mark) and foreground-colored text on dark surfaces. `leh-icon-minimal.png` is a light-surface alternative. Do not invent/change/retrace the mark or use arbitrary emojis.
2. Replace `MarketingMark` placeholder SVG and `MarketingWordmark` in `src/components/marketing/primitives.tsx`, then verify `src/components/marketing/header.tsx` and `footer.tsx` show properly proportioned approved branding.
3. Build a reusable, accessible LEH brand component with `full`, `compact`, and `icon` options; adapt to light/dark theme without hydration issues. Prefer `next/image`. Preserve labels/alt text.
4. Apply branding to `src/components/platform/platform-sidebar-header.tsx`, `src/components/platform/mobile-platform-navigation.tsx` (keep small screens navigable), `src/app/(auth)/layout.tsx`, `src/components/platform-admin/console-shell.tsx`, login and recovery flows if text-only placeholders appear elsewhere. Do not interfere with `/org_admin`'s MFA/authorisation checks.
5. Implement site identity with existing file-convention icons in `src/app/`. Update `src/app/layout.tsx` metadata to set `manifest: '/site.webmanifest'`; verify no conflicting icon or manifest metadata. Confirm GET `/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/site.webmanifest` return success and correct content types. Verify 16/32px favicon readability, browsers cache favicons aggressively.
6. Leave SEO titles/descriptions sound and do not show a giant logo in place of an app navigation label, module icon, or data diagram.
7. Add a short `docs/product/branding.md` on logo variants and sizing, light/dark placement, path references, favicon assets, and future updates; centralize branding references.
8. Add tests for logo and metadata, run typecheck/lint/format/build, Fast CI, Database CI, Full Regression as applicable. Verify desktop + mobile 360px, dark/light, landing header/footer, sign-in, product sidebar, and private `/org_admin` shell. Attach before/after screenshots to PR.

Create PR referencing `Fixes #305`; leave open, do not merge or deploy. No hosted Supabase changes or Stripe changes. User handles Netlify; ChatGPT will review PR and merge upon green checks.

Recommended: single-agent Cursor run (small cross-cutting UI task), rather than multiagent.
