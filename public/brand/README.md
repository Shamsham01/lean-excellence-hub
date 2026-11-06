# Lean Excellence Hub — official branding asset pack

Theme-specific marks are the files screens render. Do not redraw them. Originals in `public/brand/originals/` stay unmodified.

## Asset map

| Asset                                   | Usage                                                               |
| --------------------------------------- | ------------------------------------------------------------------- |
| `public/brand/leh-horizontal-light.png` | Horizontal lockup on light surfaces. 2172×724, transparent corners  |
| `public/brand/leh-horizontal-dark.png`  | Horizontal lockup on dark surfaces. 2172×724, transparent corners   |
| `public/brand/leh-icon-light.png`       | Blue square mark for light surfaces. 2000×2000, transparent corners |
| `public/brand/leh-icon-dark.png`        | Light square mark for dark surfaces. 2000×2000, transparent corners |
| `public/brand/leh-icon-dark-128.png`    | 128px derivative of the dark icon for the root error document       |
| `public/brand/leh-icon-blue.png`        | Alternate blue mark (legacy references)                             |
| `public/brand/leh-icon-blue-192.png`    | Legacy 192px manifest derivative                                    |
| `public/brand/leh-icon-light-192.png`   | Web manifest 192px — light-surface (dark-blue) mark                 |
| `public/brand/leh-icon-light-512.png`   | Web manifest 512px — light-surface mark                             |
| `public/brand/leh-horizontal.png`       | Previous horizontal master. Opaque white field. Not used in the UI  |
| `public/brand/leh-icon-minimal.png`     | Previous light icon. Opaque white field. Not used in the UI         |
| `src/app/favicon.ico`                   | Multi-resolution browser tab icon (16, 32, 48, 64)                  |
| `src/app/icon.png`                      | Next.js app icon (same artwork as `leh-icon-light.png`)             |
| `src/app/apple-icon.png`                | Apple touch icon                                                    |
| `public/site.webmanifest`               | Installed-app name and icons                                        |
| `public/brand/originals/*.png`          | Unmodified source artwork                                           |

Placement, sizing, and the favicon decision are recorded in `docs/product/branding.md`.

## QA

Check 16px and 32px browser tabs, light and dark marketing headers at 1440px and 390px, the footer, sign-in, the product sidebar, and `/org_admin`. The horizontal files must not show a white or black rectangle. Favicons are heavily cached; use a fresh private tab or hard refresh after deployment.
