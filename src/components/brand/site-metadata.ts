import type { Metadata } from "next";

/**
 * Root metadata. Primary icons use the official light-surface mark; dark-mode
 * tabs use the light mark on dark chrome via `media: "(prefers-color-scheme: dark)"`.
 */
export const rootMetadata = {
  applicationName: "Lean Excellence Hub",
  description: "A foundation for organisation-wide Lean management.",
  manifest: "/site.webmanifest",
  title: "Lean Excellence Hub",
  icons: {
    icon: [
      {
        url: "/brand/leh-icon-light.png",
        type: "image/png",
      },
      {
        url: "/brand/leh-icon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
} satisfies Metadata;
