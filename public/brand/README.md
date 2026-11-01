# Lean Excellence Hub — official branding asset pack

These assets are derived exclusively from the three supplied LEH logos. No artwork was redesigned. PNGs are cropped or resized for web use; original files are preserved in `public/brand/originals/`.

## Installation

Extract this ZIP at the **root of** `lean-excellence-hub` so the enclosed `src/app/` and `public/brand/` directories merge into the existing folders. **Commit the asset files to a feature branch** and make them available to Cursor Online by pushing the branch, or use Cursor Local on that branch.

This pack contains assets ONLY: the TSX/CSS branding integrations and metadata changes must be implemented by Cursor using the accompanying `CURSOR_TASK.md`.

## Asset map

| Asset | Usage |
|---|---|
| `public/brand/leh-horizontal.png` | Official horizontal logo (best on white/light surfaces with sufficient width) |
| `public/brand/leh-icon-blue.png` | Blue square LEH mark, transparent exterior — header, sidebar, admin, loading, compact views |
| `public/brand/leh-icon-minimal.png` | Alternative light icon |
| `public/brand/leh-icon-blue-192.png` | Web manifest smaller icon |
| `src/app/favicon.ico` | Classic multi-resolution browser tab icon |
| `src/app/icon.png` | Next.js app icon (browser and metadata) |
| `src/app/apple-icon.png` | Apple touch icon |
| `public/site.webmanifest` | PWA/browser-install identity |
| `public/brand/originals/*.png` | Unmodified source artwork for future use |

## QA

Check 16px/32px browser tabs on Chromium/Firefox/Safari, dark and light mode, landing header/footer, mobile sidebar, sign-in, and `/org_admin`. Favicons are heavily cached; use a fresh private tab or hard refresh after deployment.

Technical note: original `LEH_App_Icon_Blue.png` includes an opaque black outer background. In the web-derived blue icon, only that outside matte has been made transparent; the original is preserved unchanged. The horizontal image has an embedded white background, so do not place it on a dark container; use the blue icon + semantic text or request an official dark-background horizontal master.