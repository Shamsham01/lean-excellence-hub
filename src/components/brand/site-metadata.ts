import type { Metadata } from "next";

/**
 * Root metadata. Favicon, app icon and Apple touch icon come from the
 * App Router file conventions in `src/app/` so they are not repeated here.
 */
export const rootMetadata = {
  applicationName: "Lean Excellence Hub",
  description: "A foundation for organisation-wide Lean management.",
  manifest: "/site.webmanifest",
  title: "Lean Excellence Hub",
} satisfies Metadata;
