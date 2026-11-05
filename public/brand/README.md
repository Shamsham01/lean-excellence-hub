# Lean Excellence Hub — official branding asset pack

Theme-specific marks are the files screens render. Do not redraw them. Originals in `public/brand/originals/` stay unmodified.

## Asset map

| Asset                                    | Usage                                                               |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `public/brand/leh-horizontal-light.svg`  | **UI (preferred)** Horizontal lockup on light surfaces. Canva SVG export |
| `public/brand/leh-horizontal-light.png`  | Raster fallback / master. 2172×724, transparent corners           |
| `public/brand/leh-horizontal-dark.svg`   | **UI (preferred)** Horizontal lockup on dark surfaces               |
| `public/brand/leh-horizontal-dark.png`   | Raster fallback / master. 2172×724, transparent corners             |
| `public/brand/leh-icon-light.svg`        | **UI (preferred)** App icon for light surfaces (white field, navy outlines) |
| `public/brand/leh-icon-light.png`        | Raster fallback / master. 2000×2000, transparent corners            |
| `public/brand/leh-icon-dark.svg`         | **UI (preferred)** App icon for dark surfaces (navy field, white outlines) |
| `public/brand/leh-icon-dark.png`         | Raster fallback / master. 1254×1254, transparent corners            |
| `public/brand/leh-icon-dark-128.png`     | 128px derivative of the dark icon for the root error document       |
| `public/brand/leh-icon-blue.png`         | Blue mark used for the browser icon and web manifest                |
| `public/brand/leh-icon-blue-192.png`     | Web manifest smaller icon                                           |
| `public/brand/leh-horizontal.png`        | Previous horizontal master. Opaque white field. Not used in the UI  |
| `public/brand/leh-icon-minimal.png`      | Previous light icon. Opaque white field. Not used in the UI         |
| `src/app/favicon.ico`                    | Multi-resolution browser tab icon (16, 32, 48, 64)                  |
| `src/app/icon.png`                       | Next.js app icon                                                    |
| `src/app/apple-icon.png`                 | Apple touch icon                                                    |
| `public/site.webmanifest`                | Installed-app name and icons                                        |
| `public/brand/originals/*.png`           | Unmodified source artwork                                           |

The four theme SVGs are Canva exports that embed raster PNGs (plus an alpha mask), not path-based vectors. Use the files as supplied; do not trace or simplify them. `LehBrand` serves SVG via `<picture>` with the PNG masters as the `<img>` fallback.

Placement, sizing, and the favicon decision are recorded in `docs/product/branding.md`.

## QA

Check 16px and 32px browser tabs, light and dark marketing headers at 1440px and 390px, the footer, sign-in, the product sidebar, and `/org_admin`. The horizontal files must not show a white or black rectangle. Favicons are heavily cached; use a fresh private tab or hard refresh after deployment.
