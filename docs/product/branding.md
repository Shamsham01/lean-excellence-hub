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
| `public/brand/leh-icon-light.png` | Blue app icon for light surfaces. Transparent corners |
| `public/brand/leh-icon-dark.png` | Light app icon for dark surfaces. Transparent corners |
| `public/brand/leh-icon-dark-128.png` | 128px derivative of the dark icon for the root error document |
| `public/brand/leh-icon-blue.png` | Blue app icon used for the browser and installed-app icons |
| `public/brand/leh-icon-blue-192.png` | Manifest icon |
| `src/app/favicon.ico` | Browser tab icon, 16 and 32px |
| `src/app/icon.png` | Next.js app icon, same artwork as `leh-icon-blue.png` |
| `src/app/apple-icon.png` | Apple touch icon, opaque |
| `public/site.webmanifest` | Installed-app name and icons |

`leh-horizontal.png` and `leh-icon-minimal.png` are the previous pack. They have opaque white fields, so screens no longer reference them.

Root metadata sets `manifest: "/site.webmanifest"` and does not repeat the file-convention icons.

## Favicon review

The browser, Apple touch, and manifest icons stay on the blue mark.

`leh-icon-dark.png` is a light tile. At 16px and 32px it disappears on a light browser chrome, so it is not the tab icon. `leh-icon-light.png` is the same blue mark at a larger source, with a lower-contrast fourth node than the current favicon master, so replacing the tab icon would not improve it. The horizontal lockups are not used as favicons.

The root error page is a fixed dark document outside the theme provider. It uses `leh-icon-dark-128.png`.

## Accessibility

- A full lockup exposes “Lean Excellence Hub, Continuous Improvement OS” once, on the visible image. The other theme’s image is `display: none`.
- Compact marks expose the name and strapline as text. The icons are unlabelled.
- Icon-only marks use an accessible name when they are the only product label.
- Pass `decorative` when a parent link already has a name, such as “Lean Excellence Hub home”.
- The product name in the sidebar is a link to `/platform`. The organisation name is not part of that link.

## Updating the mark

Replace the theme files in `public/brand/` with a new export of the same artwork and the same pixel size. Keep a transparent exterior. If the ink bounds move, update `horizontalCrop` in `src/components/brand/brand-assets.ts` and check a light and dark header at 1440×900 and 390×844, the sidebar at 14rem, and the tab icon at 16px.
