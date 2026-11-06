import type { Metadata } from "next";

/**
 * Root metadata. Default tab icons come from App Router files in `src/app/`
 * (`favicon.ico`, `icon.png`, `apple-icon.png`), generated from
 * `public/brand/leh-icon-light.png`. A dark-tab variant uses
 * `leh-icon-dark-128.png` for `prefers-color-scheme: dark` only.
 */
export const rootMetadata = {
  applicationName: "Lean Excellence Hub",
  description: "A foundation for organisation-wide Lean management.",
  manifest: "/site.webmanifest",
  title: "Lean Excellence Hub",
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
        sizes: "512x512",
      },
      {
        url: "/brand/leh-icon-dark-128.png",
        type: "image/png",
        sizes: "128x128",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
} satisfies Metadata;
