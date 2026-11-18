import { existsSync } from "node:fs";
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const getClaims = vi.hoisted(() => vi.fn());
const routeAfterAuthentication = vi.hoisted(() =>
  vi.fn(async () => {
    throw Object.assign(new Error("REDIRECT:/platform"), {
      digest: "NEXT_REDIRECT;replace;/platform",
    });
  }),
);

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims },
  }),
}));

vi.mock("@/modules/identity/session", () => ({
  routeAfterAuthentication,
}));

import Home, { metadata } from "@/app/page";
import { MarketingHome } from "@/components/marketing/home";
import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";
import { HERO_HEADLINE, landingCopy } from "@/lib/marketing/landing-copy";

function section(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing section ${id}`);
  return within(element);
}

describe("public marketing homepage", () => {
  afterEach(cleanup);

  it("tells the problem-solution story in the approved section order", () => {
    render(<MarketingHome />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: HERO_HEADLINE }),
    ).toBeVisible();
    expect(screen.getByText(landingCopy.hero.lede)).toBeVisible();
    const ids = [...document.querySelectorAll("main section")].map(
      (element) => element.id,
    );
    expect(ids).toEqual([
      "hero",
      "status-quo",
      "platform",
      "connect",
      "measure",
      "floor",
      "leanai",
      "faq",
      "get-free-access",
    ]);
    // No band between the hero and the next section (plan-v3 §2a).
    expect(document.getElementById("hero")?.nextElementSibling?.id).toBe(
      "status-quo",
    );
    expect(document.querySelector(".editorial-statement")).toBeNull();
  });

  it("offers Book a demo and Get free access in the hero, with nothing under them", () => {
    render(<MarketingHome />);

    const links = section("hero").getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      DEMO_BOOKING_CTA,
      GET_FREE_ACCESS_CTA,
    ]);
    expect(links[0]).toHaveAttribute("href", "/demo");
    expect(links[1]).toHaveAttribute("href", GET_FREE_ACCESS_HREF);
    expect(GET_FREE_ACCESS_HREF).toBe("/#get-free-access");
    const actions = links[0]!.closest(".lv-actions");
    expect(actions?.nextElementSibling).toBeNull();

    const header = within(screen.getByRole("banner"));
    expect(
      header.getByRole("link", { name: DEMO_BOOKING_CTA }),
    ).toHaveAttribute("href", "/demo");
    expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(header.getAllByRole("link").map((link) => link.textContent)).toEqual(
      expect.arrayContaining(["Product", "How it works", "FAQ"]),
    );

    const footer = within(screen.getByRole("contentinfo"));
    expect(
      footer.getByRole("link", { name: GET_FREE_ACCESS_CTA }),
    ).toHaveAttribute("href", GET_FREE_ACCESS_HREF);
    expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      footer.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("keeps the official one-line lockup in the header, never the text fallback", () => {
    render(<MarketingHome />);
    const brand = within(screen.getByRole("banner")).getAllByTestId(
      "leh-brand",
    )[0]!;
    expect(brand).toHaveAttribute("data-responsive", "false");
    expect(brand.querySelector(".leh-brand-name")).toBeNull();
    expect(
      brand.querySelector('img[src="/brand/leh-horizontal-dark.png"]'),
    ).not.toBeNull();
  });

  it("shows the status quo as three pains and the six connected modules", () => {
    render(<MarketingHome />);
    expect(
      section("status-quo")
        .getAllByRole("listitem")
        .map((item) => item.querySelector("p")?.textContent),
    ).toEqual([...landingCopy.statusQuo.pains]);
    expect(
      section("platform")
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(landingCopy.platform.modules.map((module) => module.name));
  });

  it("keeps Observe, Act, Solve as built, labelled for assistive tech", () => {
    render(<MarketingHome />);
    const thread = section("connect").getByRole("list", {
      name: "Observe, Act, Solve",
    });
    expect(
      within(thread)
        .getAllByRole("listitem")
        .map((item) => item.querySelector(".editorial-label")?.textContent),
    ).toEqual(["Observe", "Act", "Solve"]);
    expect(
      [...thread.querySelectorAll("figcaption")].map(
        (node) => node.textContent,
      ),
    ).toEqual([...landingCopy.stageRecords]);
  });

  it("never names the demo organisation, quotes prices or uses retired copy", () => {
    render(<MarketingHome />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Harbourfield|Bodmin/i);
    expect(text).not.toMatch(/£|\$\d|per month|\/month|pricing/i);
    expect(text).not.toMatch(/before we go live/i);
    expect(text).not.toMatch(/Example data|Both buttons/i);
    expect(text).not.toMatch(/Book a live demo|Request free access/);
    expect(text).not.toMatch(/ACT-2026-0019|2\.7\/5/);
    for (const image of document.querySelectorAll("img")) {
      expect(image.getAttribute("alt") ?? "").not.toMatch(
        /Harbourfield|Bodmin/i,
      );
    }
    expect(
      document.querySelector('a[href="/signup"], a[href="/pricing"]'),
    ).toBeNull();
  });

  it("renders the four FAQs", () => {
    render(<MarketingHome />);
    expect(document.querySelectorAll("#faq details")).toHaveLength(4);
    for (const item of landingCopy.faq.items) {
      expect(section("faq").getByText(item.question)).toBeVisible();
      expect(section("faq").getByText(item.answer)).toBeInTheDocument();
    }
  });

  it("keeps LeanAI's three steps in reading order", () => {
    render(<MarketingHome />);
    expect(
      section("leanai")
        .getAllByRole("heading", { level: 3 })
        .map((item) => item.textContent),
    ).toEqual(["Draft", "Review", "Decide"]);
  });

  it("places the early-access form beside the walkthrough option", () => {
    render(<MarketingHome />);
    const access = section("get-free-access");
    expect(
      access.getByRole("heading", { level: 2, name: landingCopy.access.title }),
    ).toBeVisible();
    expect(
      access.getByRole("button", { name: GET_FREE_ACCESS_CTA }),
    ).toBeVisible();
    expect(
      access.getByRole("heading", { name: landingCopy.access.demoTitle }),
    ).toBeVisible();
    expect(
      access.getByRole("link", { name: DEMO_BOOKING_CTA }),
    ).toHaveAttribute("href", "/demo");
  });

  it("keeps the navigation and skip link targets valid", () => {
    render(<MarketingHome />);
    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("link", { name: "Lean Excellence Hub home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
    expect(document.getElementById("main")).toHaveAttribute("tabindex", "-1");
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/#"]',
    )) {
      expect(document.getElementById(link.hash.slice(1))).toBeInTheDocument();
    }

    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("button", { name: /Appearance/ })).toBeNull();
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    fireEvent.click(within(mobile).getByRole("link", { name: "FAQ" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });

  it("serves width-described capture variants so phones skip the large masters", () => {
    render(<MarketingHome />);

    const images = [
      ...document.querySelectorAll<HTMLImageElement>("main picture img"),
    ];
    expect(images.length).toBeGreaterThanOrEqual(7);
    for (const image of images) {
      const picture = image.closest("picture")!;
      const avif = picture.querySelector('source[type="image/avif"]')!;
      const master = image.getAttribute("src")!;
      expect(master).toMatch(
        /^\/marketing\/captures\/v[23]\/[a-z0-9-]+\.webp$/,
      );
      // Never the light V1 phone shot.
      expect(master).not.toMatch(/light/);
      const base = master.replace(/\.webp$/, "");
      const width = Number(image.getAttribute("width"));
      const expected =
        width >= 2400
          ? [
              `${base}-800w.webp 800w`,
              `${base}-1200w.webp 1200w`,
              `${base}.webp ${width}w`,
            ]
          : [`${base}-780w.webp 780w`, `${base}.webp ${width}w`];
      expect(image.getAttribute("srcset")).toBe(expected.join(", "));
      expect(avif.getAttribute("srcset")).toBe(
        expected.join(", ").replaceAll(".webp", ".avif"),
      );
      for (const candidate of [
        ...expected,
        ...expected.map((entry) => entry.replaceAll(".webp", ".avif")),
      ]) {
        expect(existsSync(`public${candidate.split(" ")[0]}`)).toBe(true);
      }
      expect(image.getAttribute("sizes")).toBeTruthy();
      expect(avif.getAttribute("sizes")).toBe(image.getAttribute("sizes"));
      expect(image.getAttribute("height")).toBeTruthy();
      const inHero = Boolean(image.closest("#hero"));
      expect(image).toHaveAttribute("loading", inHero ? "eager" : "lazy");
    }
  });
});

describe("homepage authentication routing", () => {
  beforeEach(() => {
    getClaims.mockReset();
    routeAfterAuthentication.mockClear();
    getClaims.mockResolvedValue({
      data: { claims: null },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the public homepage when the visitor is not authenticated", async () => {
    const view = await Home();
    render(view);

    expect(
      screen.getByRole("heading", {
        name: HERO_HEADLINE,
      }),
    ).toBeInTheDocument();
    expect(routeAfterAuthentication).not.toHaveBeenCalled();
  });

  it("routes authenticated visitors through the existing post-auth flow", async () => {
    getClaims.mockResolvedValueOnce({
      data: { claims: { sub: "user-1" } },
      error: null,
    });

    await expect(Home()).rejects.toThrow("REDIRECT:/platform");
    expect(routeAfterAuthentication).toHaveBeenCalledTimes(1);
  });

  it("uses the landing promise in public metadata", () => {
    expect(metadata.description).toBe(landingCopy.hero.lede);
  });
});
