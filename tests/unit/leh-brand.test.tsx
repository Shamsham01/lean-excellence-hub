import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import {
  LEH_BRAND,
  LEH_BRAND_HOME_LABEL,
} from "@/components/brand/brand-assets";
import { LehBrand, LehBrandHomeLink } from "@/components/brand/leh-brand";
import { rootMetadata } from "@/components/brand/site-metadata";
import { MarketingHeader } from "@/components/marketing/header";

describe("LehBrand", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses the official horizontal lockup for the full mark", () => {
    render(<LehBrand variant="full" />);

    const brand = screen.getByTestId("leh-brand");
    expect(brand).toHaveAttribute("data-variant", "full");
    expect(
      within(brand).getByRole("img", { name: LEH_BRAND.name }),
    ).toHaveAttribute("src", expect.stringContaining("leh-horizontal.png"));
    expect(within(brand).getByText(LEH_BRAND.name)).toBeInTheDocument();
    expect(within(brand).getByText(LEH_BRAND.strapline)).toBeInTheDocument();
  });

  it("pairs an icon with the product name for the compact mark", () => {
    render(<LehBrand variant="compact" />);

    const brand = screen.getByTestId("leh-brand");
    const sources = [...brand.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    );
    expect(sources.some((src) => src?.includes("leh-icon-blue.png"))).toBe(
      true,
    );
    expect(sources.some((src) => src?.includes("leh-icon-minimal.png"))).toBe(
      true,
    );
    expect(
      within(brand).queryByRole("img", { name: LEH_BRAND.name }),
    ).not.toBeInTheDocument();
    expect(within(brand).getByText(LEH_BRAND.name)).toBeVisible();
  });

  it("names an icon-only mark without repeating the wordmark", () => {
    render(<LehBrand variant="icon" />);

    const brand = screen.getByRole("img", { name: LEH_BRAND.name });
    expect(brand).toHaveAttribute("data-variant", "icon");
    expect(within(brand).queryByText(LEH_BRAND.name)).not.toBeInTheDocument();
  });

  it("hides a decorative mark from the accessibility tree", () => {
    render(<LehBrand decorative variant="full" />);

    expect(screen.getByTestId("leh-brand")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.queryByRole("img", { name: LEH_BRAND.name }),
    ).not.toBeInTheDocument();
  });

  it("keeps the marketing home link name", () => {
    render(<MarketingHeader />);

    expect(
      screen.getByRole("link", { name: LEH_BRAND_HOME_LABEL }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByTestId("leh-brand")).toHaveAttribute(
      "data-variant",
      "full",
    );
  });

  it("exposes a home link with a decorative mark", () => {
    render(<LehBrandHomeLink />);

    const link = screen.getByRole("link", { name: LEH_BRAND_HOME_LABEL });
    expect(link).toHaveAttribute("href", "/");
    expect(within(link).getByTestId("leh-brand")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("site identity metadata", () => {
  it("points at the web manifest and leaves file-convention icons alone", () => {
    expect(rootMetadata.manifest).toBe("/site.webmanifest");
    expect(rootMetadata.applicationName).toBe(LEH_BRAND.name);
    expect(rootMetadata).not.toHaveProperty("icons");
  });

  it("ships the favicon, app icons and manifest from the official pack", () => {
    const favicon = readFileSync("src/app/favicon.ico");
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(favicon.readUInt16LE(4)).toBeGreaterThan(0);

    for (const path of [
      "src/app/icon.png",
      "src/app/apple-icon.png",
      "public/brand/leh-horizontal.png",
      "public/brand/leh-icon-blue.png",
      "public/brand/leh-icon-minimal.png",
      "public/brand/originals/LEH_Horizontal_Logo.png",
    ]) {
      const file = readFileSync(path);
      expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }

    const manifest = JSON.parse(
      readFileSync("public/site.webmanifest", "utf8"),
    );
    expect(manifest.name).toBe(LEH_BRAND.name);
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/brand/leh-icon-blue-192.png",
      "/brand/leh-icon-blue.png",
    ]);
  });

  it("hides the white horizontal lockup in dark mode", () => {
    const css = readFileSync("src/components/brand/leh-brand.css", "utf8");
    expect(css).toContain(
      '.dark .leh-brand[data-variant="full"] .leh-brand-lockup',
    );
    expect(css).toContain("visibility: hidden");
    expect(css).toContain("aspect-ratio: 1500 / 337");
  });
});
