# Lean Excellence Hub branding

Official marks live in `public/brand/`. Do not redraw them. The originals in `public/brand/originals/` stay unmodified for future exports.

## Variants

Use `LehBrand` from `src/components/brand/leh-brand.tsx`. Theme follows the `dark` class from next-themes. Both files are in the document; CSS shows one, so a stored theme cannot flash the other file during hydration.

| Variant | Light | Dark | Where |
| --- | --- | --- | --- |
| `full` | `leh-horizontal-light.png` | `leh-horizontal-dark.png` | Marketing header and footer, sign-in, onboarding, platform-owner sign-in and console |
| `compact` | `leh-icon-light.png` plus the name | `leh-icon-dark.png` plus the name | Sidebar, platform drawer, simulated product chrome |
| `icon` | `leh-icon-light.png` | `leh-icon-dark.png` | Mobile platform bar, empty and error states |

`responsive` on a full mark collapses it below 40rem to the icon plus the name, with the strapline hidden, so header controls still fit. Desktop keeps the horizontal lockup in both themes.

The horizontal files are 2172×724. Their corners are transparent. The artwork sits in a shared inset (crop `199,187` size `1779×355`). That inset is placed in the previous 1500×337 slot at 17.5rem wide, so the landing header stays 88px at 1440px and 65px at 390px. The clear margin is not painted as a background.

Organisation names stay separate from the product mark. The sidebar and mobile bar still show the organisation beside or under the brand.

## Assets

| Path | Role |
| --- | --- |
| `public/brand/leh-horizontal-light.png` | Horizontal lockup for light surfaces. Transparent exterior |
| `public/brand/leh-horizontal-dark.png` | Horizontal lockup for dark surfaces. Transparent exterior |
| `public/brand/leh-icon-light.png` | Bright azure app icon (≈ `#0058FD`) for light surfaces. Transparent corners |
| `public/brand/leh-icon-dark.png` | Light app icon for dark surfaces. Transparent corners |
| `public/brand/leh-icon-dark-128.png` | 128px derivative of the dark icon for the root error document and dark-tab metadata |
| `public/brand/leh-icon-light-192.png` | Manifest icon (192px), from `leh-icon-light.png` |
| `public/brand/leh-icon-light-512.png` | Manifest icon (512px); matches `src/app/icon.png` |
| `public/brand/leh-icon-blue.png` | Legacy blue mark; not used for tabs or manifest |
| `public/brand/leh-icon-blue-192.png` | Legacy manifest size; retained for reference only |
| `src/app/favicon.ico` | Browser tab icon (16–64px), from `leh-icon-light.png` |
| `src/app/icon.png` | Next.js app icon, from `leh-icon-light.png` |
| `src/app/apple-icon.png` | Apple touch icon, from `leh-icon-light.png` |
| `public/site.webmanifest` | Installed-app name and icons |

`leh-horizontal.png` and `leh-icon-minimal.png` are the previous pack. They have opaque white fields, so screens no longer reference them.

Root metadata sets `manifest: "/site.webmanifest"` and adds a dark-tab icon via `prefers-color-scheme: dark` (`leh-icon-dark-128.png`). File-convention icons in `src/app/` use the light-theme master.

## Favicon review

Default browser, Apple touch, and manifest icons use the approved light-theme app icon (`leh-icon-light.png`: white rounded square with a bright azure fill ≈ `#0058FD`). When the OS prefers dark chrome, the tab icon switches to `leh-icon-dark-128.png`. The horizontal lockups are not used as favicons.

`leh-icon-dark.png` remains the light tile for dark **app** surfaces. Root metadata uses `leh-icon-dark-128.png` only for **dark browser chrome**, not for in-app sidebars.

The root error page is a fixed dark document outside the theme provider. It uses `leh-icon-dark-128.png`.

## Accessibility

- A full lockup exposes “Lean Excellence Hub, Continuous Improvement OS” once, on the visible image. The other theme’s image is `display: none`.
- Compact marks expose the name and strapline as text. The icons are unlabelled.
- Icon-only marks use an accessible name when they are the only product label.
- Pass `decorative` when a parent link already has a name, such as “Lean Excellence Hub home”.
- The product name in the sidebar is a link to `/platform`. The organisation name is not part of that link.

## Updating the mark

Replace the theme files in `public/brand/` with a new export of the same artwork and the same pixel size. Keep a transparent exterior. If the ink bounds move, update `horizontalCrop` in `src/components/brand/brand-assets.ts` and check a light and dark header at 1440×900 and 390×844, the sidebar at 14rem, and the tab icon at 16px.
