# Lean Excellence Hub — official branding asset pack

Theme-specific marks are the files screens render. Do not redraw them. Originals in `public/brand/originals/` stay unmodified.

## Asset map

| Asset                                   | Usage                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `public/brand/leh-horizontal-light.svg` | **UI (preferred)** Horizontal lockup on light surfaces. Canva SVG export              |
| `public/brand/leh-horizontal-light.png` | Raster fallback / master. 2172×724, transparent corners                               |
| `public/brand/leh-horizontal-dark.svg`  | **UI (preferred)** Horizontal lockup on dark surfaces                                 |
| `public/brand/leh-horizontal-dark.png`  | Raster fallback / master. 2172×724, transparent corners                               |
| `public/brand/leh-icon-light.svg`       | **UI (preferred)** App icon for light surfaces (white field, navy outlines)           |
| `public/brand/leh-icon-light.png`       | Raster fallback / master — bright azure (≈ `#0058FD`), transparent corners            |
| `public/brand/leh-icon-dark.svg`        | **UI (preferred)** App icon for dark surfaces (navy field, white outlines)            |
| `public/brand/leh-icon-dark.png`        | Raster fallback / master. 1254×1254, transparent corners                              |
| `public/brand/leh-icon-dark-128.png`    | 128px dark icon for root error page; dark-tab metadata (`prefers-color-scheme: dark`) |
| `public/brand/leh-icon-light-192.png`   | Web manifest icon (192px), derived from `leh-icon-light.png`                          |
| `public/brand/leh-icon-light-512.png`   | Web manifest icon (512px) and source for `src/app/icon.png`                           |
| `public/brand/leh-icon-blue.png`        | Legacy blue mark; no longer used for tab or manifest icons                            |
| `public/brand/leh-icon-blue-192.png`    | Legacy manifest size; retained for reference only                                     |
| `public/brand/leh-horizontal.png`       | Previous horizontal master. Opaque white field. Not used in the UI                    |
| `public/brand/leh-icon-minimal.png`     | Previous light icon. Opaque white field. Not used in the UI                           |
| `src/app/favicon.ico`                   | Browser tab icon (16–64px), from `leh-icon-light.png`                                 |
| `src/app/icon.png`                      | Next.js app icon (512px), from `leh-icon-light.png`                                   |
| `src/app/apple-icon.png`                | Apple touch icon (180px), from `leh-icon-light.png`                                   |
| `public/site.webmanifest`               | Installed-app name and icons                                                          |
| `public/brand/originals/*.png`          | Unmodified source artwork                                                             |

The four theme SVGs are Canva exports that embed raster PNGs (plus an alpha mask), not path-based vectors. Use the files as supplied; do not trace or simplify them. `LehBrand` serves SVG via `<picture>` with the PNG masters as the `<img>` fallback. Sign-in, marketing header, and platform sidebar use `lockupRasterOnly` (PNG only) with `object-fit: contain` in a fixed slot — no crop offsets.

Placement, sizing, and the favicon decision are recorded in `docs/product/branding.md`.

## QA

Check 16px and 32px browser tabs, light and dark marketing headers at 1440px and 390px, the footer, sign-in, the product sidebar, and `/org_admin`. The horizontal files must not show a white or black rectangle. Favicons are heavily cached; use a fresh private tab or hard refresh after deployment.
