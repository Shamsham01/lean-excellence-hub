# Lean Excellence Hub branding

Official marks live in `public/brand/`. Do not redraw them. The originals in `public/brand/originals/` stay unmodified for future exports.

## Variants

Use `LehBrand` from `src/components/brand/leh-brand.tsx`.

| Variant | Light | Dark | Where |
| --- | --- | --- | --- |
| `full` | `leh-horizontal.png`, about 17.5rem wide | Blue icon plus the name and strapline in text | Marketing header and footer, sign-in, platform-owner sign-in |
| `compact` | Minimal line icon plus the name | Blue icon plus the name | Sidebar, mobile drawer, platform-owner console, organisation setup |
| `icon` | Minimal line icon | Blue icon | Mobile platform bar, simulated product chrome, empty and error states |

`responsive` on a full mark collapses it to the compact treatment below 40rem so the name stays readable beside header controls. The horizontal file has a white matte, so it is hidden in `.dark` and on that narrow collapse. Proportions stay on `aspect-ratio: 1500 / 337` for the lockup and a square box for the icons.

Organisation names stay separate from the product mark. The sidebar and mobile bar still show the organisation beside or under the brand.

## Assets

| Path | Role |
| --- | --- |
| `public/brand/leh-horizontal.png` | Horizontal lockup, light surfaces only |
| `public/brand/leh-icon-blue.png` | App icon with a transparent exterior |
| `public/brand/leh-icon-minimal.png` | Light-surface line icon. It has an opaque white field |
| `public/brand/leh-icon-blue-192.png` | Manifest icon |
| `src/app/favicon.ico` | Browser tab icon |
| `src/app/icon.png` | Next.js app icon |
| `src/app/apple-icon.png` | Apple touch icon |
| `public/site.webmanifest` | Installed-app name and icons |

Root metadata sets `manifest: "/site.webmanifest"` and does not repeat the file-convention icons.

## Accessibility

- Full and compact marks expose the words “Lean Excellence Hub” once: the lockup’s alternative text on light, or the text name when the lockup is hidden.
- Icon-only marks use an accessible name when they are the only product label.
- Pass `decorative` when a parent link already has a name, such as “Lean Excellence Hub home”.
- The product name in the sidebar is a link to `/platform`. The organisation name is not part of that link.

## Updating the mark

Replace the files in `public/brand/` and `src/app/` with a new export of the same artwork. Keep the filenames, the horizontal aspect ratio, and a transparent exterior on the blue icon. Then check a light and dark header, the sidebar at 14rem, a 360px header, and the tab icon at 16px.
