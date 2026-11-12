import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
  LEH_BRAND_LOCKUP_LABEL,
} from "@/components/brand/brand-assets";
import { LehBrand, LehBrandHomeLink } from "@/components/brand/leh-brand";
import { rootMetadata } from "@/components/brand/site-metadata";
import { MarketingHeader } from "@/components/marketing/header";

function pngHeader(path: string) {
  const file = readFileSync(path);
  expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(file.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    file,
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    bitDepth: file[24],
    colorType: file[25],
  };
}

function svgRoot(path: string) {
  const file = readFileSync(path, "utf8");
  expect(file.trimStart().startsWith("<svg")).toBe(true);
  expect(file).toContain('xmlns="http://www.w3.org/2000/svg"');
  return file;
}

function brandMediaSources(container: ParentNode) {
  const svgSources = [...container.querySelectorAll("picture source")].map(
    (node) => node.getAttribute("srcSet"),
  );
  const rasterSources = [...container.querySelectorAll("picture img")].map(
    (node) => node.getAttribute("src"),
  );
  return { svgSources, rasterSources };
}

function cornerAlpha(file: Buffer) {
  let offset = 8;
  const idats: Buffer[] = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;

  while (offset + 12 <= file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idats));
  const row = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);
  let source = 0;

  function paeth(left: number, up: number, upLeft: number) {
    const estimate = left + up - upLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upLeftDistance = Math.abs(estimate - upLeft);
    if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
      return left;
    }
    if (upDistance <= upLeftDistance) {
      return up;
    }
    return upLeft;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source] ?? 0;
    source += 1;
    const raw = inflated.subarray(source, source + stride);
    source += stride;
    for (let index = 0; index < stride; index += 1) {
      const left =
        index >= bytesPerPixel ? (row[index - bytesPerPixel] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const upLeft =
        index >= bytesPerPixel ? (previous[index - bytesPerPixel] ?? 0) : 0;
      const value = raw[index] ?? 0;
      if (filter === 0) row[index] = value;
      else if (filter === 1) row[index] = (value + left) & 255;
      else if (filter === 2) row[index] = (value + up) & 255;
      else if (filter === 3)
        row[index] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4)
        row[index] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`Unexpected PNG filter ${filter}`);
    }
    if (y === 0 || y === height - 1) {
      expect(row[3]).toBe(0);
      expect(row[stride - 1]).toBe(0);
    }
    row.copy(previous);
  }
}

describe("LehBrand", () => {
  let brandStyles: HTMLStyleElement;

  beforeAll(() => {
    brandStyles = document.createElement("style");
    brandStyles.textContent = readFileSync(
      "src/components/brand/leh-brand.css",
      "utf8",
    );
    document.head.appendChild(brandStyles);
  });

  afterAll(() => {
    brandStyles?.remove();
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    cleanup();
  });

  it("uses the light and dark horizontal lockups for the full mark", () => {
    render(<LehBrand variant="full" />);

    const brand = screen.getByTestId("leh-brand");
    expect(brand).toHaveAttribute("data-variant", "full");
    const lockupImgs = brand.querySelectorAll(".leh-brand-lockup img");
    expect(lockupImgs).toHaveLength(2);
    expect(brand.querySelector(".leh-brand-lockup-light")).toBeVisible();
    expect(brand.querySelector(".leh-brand-lockup-dark")).not.toBeVisible();
    const { svgSources, rasterSources } = brandMediaSources(brand);
    expect(
      svgSources.some((src) => src?.includes("leh-horizontal-light.svg")),
    ).toBe(true);
    expect(
      svgSources.some((src) => src?.includes("leh-horizontal-dark.svg")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-horizontal-light.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-horizontal-dark.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-horizontal.png")),
    ).toBe(false);
    expect(within(brand).queryByText(LEH_BRAND.name)).not.toBeInTheDocument();
    expect(brand.querySelector(".leh-brand-lockup")).toBeTruthy();
  });

  it("pairs theme icons with the product name for the compact mark", () => {
    render(<LehBrand variant="compact" />);

    const brand = screen.getByTestId("leh-brand");
    const { svgSources, rasterSources } = brandMediaSources(brand);
    expect(svgSources.some((src) => src?.includes("leh-icon-light.svg"))).toBe(
      true,
    );
    expect(svgSources.some((src) => src?.includes("leh-icon-dark.svg"))).toBe(
      true,
    );
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-light.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-dark.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-minimal.png")),
    ).toBe(false);
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-blue.png")),
    ).toBe(false);
    expect(
      within(brand).queryByRole("img", { name: LEH_BRAND.name }),
    ).not.toBeInTheDocument();
    expect(within(brand).getByText(LEH_BRAND.name)).toBeVisible();
    expect(within(brand).getByText(LEH_BRAND.strapline)).toBeVisible();
  });

  it("shows only the light icon mark in light theme", () => {
    document.documentElement.classList.remove("dark");
    render(<LehBrand variant="icon" />);

    const brand = screen.getByRole("img", { name: LEH_BRAND.name });
    const lightWrap = brand.querySelector(".leh-brand-mark-light");
    const darkWrap = brand.querySelector(".leh-brand-mark-dark");
    expect(lightWrap).toBeTruthy();
    expect(darkWrap).toBeTruthy();
    expect(lightWrap).toBeVisible();
    expect(darkWrap).not.toBeVisible();
    expect(lightWrap?.querySelector("img")?.getAttribute("src")).toContain(
      "leh-icon-light.png",
    );
    expect(darkWrap?.querySelector("img")?.getAttribute("src")).toContain(
      "leh-icon-dark.png",
    );
    expect(darkWrap?.querySelector("img")?.getAttribute("src")).not.toContain(
      "leh-icon-blue",
    );
  });

  it("shows only the dark icon mark when html has class dark", () => {
    document.documentElement.classList.add("dark");
    render(<LehBrand variant="icon" />);

    const brand = screen.getByRole("img", { name: LEH_BRAND.name });
    const lightWrap = brand.querySelector(".leh-brand-mark-light");
    const darkWrap = brand.querySelector(".leh-brand-mark-dark");
    expect(lightWrap).not.toBeVisible();
    expect(darkWrap).toBeVisible();
    expect(darkWrap?.querySelector("img")?.getAttribute("src")).toContain(
      "leh-icon-dark.png",
    );
    document.documentElement.classList.remove("dark");
  });

  it("names an icon-only mark without repeating the wordmark", () => {
    render(<LehBrand variant="icon" />);

    const brand = screen.getByRole("img", { name: LEH_BRAND.name });
    expect(brand).toHaveAttribute("data-variant", "icon");
    expect(within(brand).queryByText(LEH_BRAND.name)).not.toBeInTheDocument();
    const { svgSources, rasterSources } = brandMediaSources(brand);
    expect(svgSources.some((src) => src?.includes("leh-icon-light.svg"))).toBe(
      true,
    );
    expect(svgSources.some((src) => src?.includes("leh-icon-dark.svg"))).toBe(
      true,
    );
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-light.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-icon-dark.png")),
    ).toBe(true);
  });

  it("keeps a responsive full mark ready to collapse without a second name", () => {
    render(<LehBrand priority responsive variant="full" />);

    const brand = screen.getByTestId("leh-brand");
    expect(brand).toHaveAttribute("data-responsive", "true");
    const { svgSources, rasterSources } = brandMediaSources(brand);
    expect(
      svgSources.filter((src) => src?.includes("leh-horizontal-light.svg")),
    ).toHaveLength(1);
    expect(
      svgSources.filter((src) => src?.includes("leh-icon-light.svg")),
    ).toHaveLength(1);
    expect(
      rasterSources.filter((src) => src?.includes("leh-horizontal-light.png")),
    ).toHaveLength(1);
    expect(
      rasterSources.filter((src) => src?.includes("leh-icon-light.png")),
    ).toHaveLength(1);
    expect(brand.querySelectorAll(".leh-brand-lockup img")).toHaveLength(2);
    expect(brand.querySelector(".leh-brand-lockup-light")).toBeVisible();
    expect(brand.querySelector(".leh-brand-lockup-dark")).not.toBeVisible();
  });

  it("hides a decorative mark from the accessibility tree", () => {
    render(<LehBrand decorative variant="full" />);

    expect(screen.getByTestId("leh-brand")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.queryByRole("img", { name: LEH_BRAND_LOCKUP_LABEL }),
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
    expect(screen.getByTestId("leh-brand")).toHaveAttribute(
      "data-responsive",
      "true",
    );
    const brand = screen.getByTestId("leh-brand");
    expect(brand.querySelector(".leh-brand-lockup picture source")).toBeNull();
    const lockupSrcs = [...brand.querySelectorAll(".leh-brand-lockup img")].map(
      (node) => node.getAttribute("src"),
    );
    expect(
      lockupSrcs.every(
        (src) => src?.includes(".png") && !src?.includes(".svg"),
      ),
    ).toBe(true);
  });

  it("exposes a home link with a decorative mark", () => {
    render(<LehBrandHomeLink />);

    const link = screen.getByRole("link", { name: LEH_BRAND_HOME_LABEL });
    expect(link).toHaveAttribute("href", "/");
    const brand = within(link).getByTestId("leh-brand");
    expect(brand).toHaveAttribute("aria-hidden", "true");
    expect(brand.querySelector(".leh-brand-lockup picture source")).toBeNull();
  });

  it("forces the dark horizontal lockup on dark auth surfaces", () => {
    render(<LehBrand decorative lockupOnDarkSurface variant="full" />);

    const brand = screen.getByTestId("leh-brand");
    expect(brand).toHaveAttribute("data-lockup-surface", "dark");
    expect(brand.querySelector(".leh-brand-lockup-dark")).toBeVisible();
    expect(brand.querySelector(".leh-brand-lockup-light")).not.toBeVisible();
    const darkImg = brand.querySelector(
      ".leh-brand-lockup-dark .leh-brand-lockup-img",
    );
    expect(darkImg?.getAttribute("src")).toContain("leh-horizontal-dark.png");
  });
});

describe("site identity metadata", () => {
  it("points at the web manifest and uses the dark mark for tab icons", () => {
    expect(rootMetadata.manifest).toBe("/site.webmanifest");
    expect(rootMetadata.applicationName).toBe(LEH_BRAND.name);
    expect(rootMetadata.icons?.apple).toEqual([
      {
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ]);
    const icons = rootMetadata.icons?.icon;
    expect(Array.isArray(icons)).toBe(true);
    expect(
      icons?.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "url" in entry &&
          String(entry.url).includes("icon.png"),
      ),
    ).toBe(true);
    expect(
      icons?.every(
        (entry) =>
          typeof entry !== "object" ||
          entry === null ||
          !("media" in entry) ||
          entry.media === undefined,
      ),
    ).toBe(true);
  });

  it("renders sidebar lockups as PNG masters in a full-width slot", () => {
    render(
      <LehBrand
        decorative
        lockupRasterOnly
        variant="full"
        className="leh-brand--platform-sidebar"
      />,
    );
    const brand = screen.getByTestId("leh-brand");
    expect(brand.querySelector("picture source")).toBeNull();
    const rasterSources = [
      ...brand.querySelectorAll(".leh-brand-lockup-img"),
    ].map((node) => node.getAttribute("src"));
    expect(
      rasterSources.some((src) => src?.includes("leh-horizontal-light.png")),
    ).toBe(true);
    expect(
      rasterSources.some((src) => src?.includes("leh-horizontal-dark.png")),
    ).toBe(true);
  });

  it("registers SVG-first theme lockups and icons with PNG raster fallbacks", () => {
    expect(LEH_BRAND.horizontalLight.src).toBe(
      "/brand/leh-horizontal-light.svg",
    );
    expect(LEH_BRAND.horizontalLight.rasterFallbackSrc).toBe(
      "/brand/leh-horizontal-light.png",
    );
    expect(LEH_BRAND.iconDark.src).toBe("/brand/leh-icon-dark.svg");
    expect(LEH_BRAND.iconDark.rasterFallbackSrc).toBe(
      "/brand/leh-icon-dark.png",
    );

    for (const path of [
      "public/brand/leh-horizontal-light.svg",
      "public/brand/leh-horizontal-dark.svg",
      "public/brand/leh-icon-light.svg",
      "public/brand/leh-icon-dark.svg",
    ]) {
      svgRoot(path);
    }
  });

  it("ships the dark-theme app icon for tabs and transparent theme masters", () => {
    const favicon = readFileSync("src/app/favicon.ico");
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    const count = favicon.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => {
      const width = favicon[6 + index * 16] ?? 0;
      return width === 0 ? 256 : width;
    });
    expect(sizes).toEqual(expect.arrayContaining([16, 32]));

    expect(
      readFileSync("src/app/icon.png").equals(
        readFileSync("public/brand/leh-icon-dark-512.png"),
      ),
    ).toBe(true);

    const masters = [
      ["public/brand/leh-horizontal-light.png", 2172, 724],
      ["public/brand/leh-horizontal-dark.png", 2172, 724],
      ["public/brand/leh-icon-light.png", 2000, 2000],
      ["public/brand/leh-icon-dark.png", 1254, 1254],
      ["public/brand/leh-icon-dark-128.png", 128, 128],
    ] as const;

    for (const [path, width, height] of masters) {
      const header = pngHeader(path);
      expect(header.width).toBe(width);
      expect(header.height).toBe(height);
      expect(header.colorType).toBe(6);
      cornerAlpha(header.file);
    }

    const manifest = JSON.parse(
      readFileSync("public/site.webmanifest", "utf8"),
    );
    expect(manifest.name).toBe(LEH_BRAND.name);
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/brand/leh-icon-dark-192.png",
      "/brand/leh-icon-dark-512.png",
    ]);
    expect(
      manifest.icons.some((icon: { src: string }) =>
        icon.src.includes("horizontal"),
      ),
    ).toBe(false);
  });

  it("switches lockup and icon files from the theme class without resizing the slot", () => {
    const css = readFileSync("src/components/brand/leh-brand.css", "utf8");
    expect(css).toContain(".leh-brand-lockup-light");
    expect(css).toContain(".leh-brand-fallback picture.leh-brand-mark-dark");
    expect(css).toContain(
      ".dark .leh-brand-lockup picture.leh-brand-lockup-dark",
    );
    expect(css).toContain(
      ".dark .leh-brand-fallback picture.leh-brand-mark-dark",
    );
    expect(css).toContain("object-fit: contain");
    expect(css).toContain(
      '.marketing-header .leh-brand[data-variant="full"] .leh-brand-lockup-img',
    );
    expect(css).toContain(
      '.leh-brand-auth-shell .leh-brand[data-variant="full"] .leh-brand-lockup-img',
    );
    expect(css).toContain(".leh-brand--platform-sidebar .leh-brand-lockup-img");
    expect(css).toContain('.leh-brand--platform-sidebar[data-variant="full"]');
    expect(css).not.toContain("object-fit: none");
    expect(css).not.toContain("visibility: hidden");
    expect(css).not.toContain("leh-horizontal.png");
  });
});
