import type { Metadata } from "next";

/**
 * Root metadata. Tab and app icons come from App Router files in `src/app/`
 * (`favicon.ico`, `icon.png`, `apple-icon.png`), with `leh-icon-dark.svg`
 * preferred in metadata; PNG and ICO remain as fallbacks for all browser chrome.
 */
export const rootMetadata = {
  applicationName: "Lean Excellence Hub",
  description: "A foundation for organisation-wide Lean management.",
  manifest: "/site.webmanifest",
  title: "Lean Excellence Hub",
  icons: {
    icon: [
      {
        url: "/brand/leh-icon-dark.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icon.png",
        type: "image/png",
        sizes: "512x512",
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
