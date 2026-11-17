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
  REQUEST_FREE_ACCESS_CTA,
} from "@/lib/marketing/demo-booking";
import { HERO_HEADLINE, landingCopy } from "@/lib/marketing/landing-copy";

function section(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing section ${id}`);
  return within(element);
}

describe("public marketing homepage", () => {
  afterEach(cleanup);

  it("renders the eight sections and the approved headline", () => {
    render(<MarketingHome />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: HERO_HEADLINE })).toBeVisible();
    expect(screen.getByText(landingCopy.hero.lede)).toBeVisible();
    const ids = [...document.querySelectorAll("main section")].map(
      (element) => element.id,
    );
    expect(ids).toEqual([
      "hero",
      "connect",
      "why",
      "five-s",
      "platform",
      "leanai",
      "faq",
      "close",
    ]);
    expect(screen.queryByTestId("leh-demo-start-suggestion")).toBeNull();
  });

  it("offers the same booking choices in the hero and close", () => {
    render(<MarketingHome />);

    for (const id of ["hero", "close"]) {
      const links = section(id).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual([
        DEMO_BOOKING_CTA,
        REQUEST_FREE_ACCESS_CTA,
      ]);
      for (const link of links) expect(link).toHaveAttribute("href", "/demo");
    }
    expect(
      section("hero").getByText(
        "Both buttons open the same booking page. Pick a time and it is booked straight away.",
      ),
    ).toBeVisible();
    expect(section("close").getByText(landingCopy.close.helper)).toBeVisible();
    expect(
      section("close").getByText(
        /free access for your team or site while Lean Excellence Hub is in early access/,
      ),
    ).toBeVisible();

    const header = within(screen.getByRole("banner"));
    expect(
      header.getByRole("link", { name: DEMO_BOOKING_CTA }),
    ).toHaveAttribute("href", "/demo");
    expect(
      header.queryByRole("link", { name: REQUEST_FREE_ACCESS_CTA }),
    ).toBeNull();
    expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );

    const footer = within(screen.getByRole("contentinfo"));
    expect(
      footer.getByRole("link", { name: REQUEST_FREE_ACCESS_CTA }),
    ).toHaveAttribute("href", "/demo");
    expect(
      document.querySelector('a[href="/signup"], a[href="/pricing"]'),
    ).toBeNull();
    expect(
      screen.queryByText(/Create an account|£49|\$49|49\/month/i),
    ).toBeNull();
  });

  it("shows the approved fictional records and labels the result as example data", () => {
    render(<MarketingHome />);

    expect(
      section("hero").getByRole("heading", {
        level: 3,
        name: landingCopy.captions.action,
      }),
    ).toBeVisible();
    expect(
      section("hero").queryAllByRole("heading", { level: 2 }),
    ).toHaveLength(0);
    expect(section("hero").getByText("Harbourfield Manager")).toBeVisible();
    expect(section("hero").getByText(landingCopy.audit.title)).toBeVisible();
    const thread = section("connect");
    for (const record of [
      landingCopy.captions.finding,
      landingCopy.captions.action,
      landingCopy.captions.case,
    ]) {
      expect(thread.getByText(record)).toBeVisible();
    }
    expect(thread.getAllByText(landingCopy.credit)).toHaveLength(1);
    expect(
      section("why").getByRole("img", { name: landingCopy.phoneAlt }),
    ).toBeVisible();
    expect(section("platform").getByText("2.7/5")).toBeVisible();
    expect(
      section("platform").getByText(
        "ACT-2026-0019 · Restore missing tools on Line 2 shadow board",
      ),
    ).toBeVisible();
    expect(section("platform").getByText(landingCopy.credit)).toBeVisible();
    expect(section("five-s").queryByText(/ACT-2026-0019/)).toBeNull();
    expect(
      screen.queryAllByText(
        /GEM-214|ACT-318|PS-077|PRJ-042|BEN-019|CAP-014|SUG-018|ACT-1042|Manchester DC|Goods-in|Friday|Packing supervisor|CI manager|DMAIC/i,
      ),
    ).toHaveLength(0);
  });

  it("renders the five FAQs and offers the access link in the booking answer", () => {
    render(<MarketingHome />);
    expect(document.querySelectorAll("#faq details")).toHaveLength(5);
    for (const item of landingCopy.faq.items) {
      expect(section("faq").getByText(item.question)).toBeVisible();
      expect(section("faq").getByText(item.answer)).toBeInTheDocument();
    }
    const booking = section("faq")
      .getByText(landingCopy.faq.items[1].question)
      .closest("details");
    booking?.setAttribute("open", "");
    expect(
      within(booking!).getByRole("link", { name: REQUEST_FREE_ACCESS_CTA }),
    ).toHaveAttribute("href", "/demo");
  });

  it("keeps LeanAI's six steps in reading order", () => {
    render(<MarketingHome />);
    expect(
      section("leanai")
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(landingCopy.leanAI.steps);
  });

  it("keeps the navigation and skip link targets valid without an appearance menu", () => {
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
    expect(screen.queryByText(/Appearance/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Appearance/ })).toBeNull();
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    fireEvent.click(within(mobile).getByRole("link", { name: "LeanAI" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });

  it("captions the real captures by what they show", () => {
    render(<MarketingHome />);

    const captions = [...document.querySelectorAll("figcaption")].map(
      (node) => node.textContent,
    );
    expect(captions).toEqual([
      "Packaging film misaligned on Packing Line 1",
      "Realign the film guide and confirm the first-off pack",
      "Recurring film wander on Packing Line 1",
      "Maturity assessment on the floor · light mode",
      "Harbourfield Foods Group · platform home",
      "Raise action · LEH Workplace 5S Standard",
      "Realign the film guide and confirm the first-off pack",
      "Cause analysis",
    ]);
    // V1 is an in-progress formal assessment, and V2 uses the LEH Workplace
    // 5S Standard, so neither may be described as anything else.
    expect(landingCopy.phoneAlt).toMatch(
      /in-progress formal maturity assessment/,
    );
    for (const text of [landingCopy.phoneAlt, ...captions]) {
      expect(text).not.toMatch(
        /self-assessment|Harbourfield Operating Standard|overdue/i,
      );
    }
    expect(
      section("five-s").getByText("Raise action · LEH Workplace 5S Standard"),
    ).toBeVisible();
  });

  it("serves width-described capture variants so phones skip the 2400 px masters", () => {
    render(<MarketingHome />);

    const images = [
      ...document.querySelectorAll<HTMLImageElement>("figure picture img"),
    ];
    expect(images).toHaveLength(8);
    for (const image of images) {
      const picture = image.closest("picture")!;
      const avif = picture.querySelector('source[type="image/avif"]')!;
      const master = image.getAttribute("src")!;
      expect(master).toMatch(
        /^\/marketing\/captures\/v2\/v[1-6]b?-[a-z0-9-]+\.webp$/,
      );
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
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image.getAttribute("height")).toBeTruthy();
    }
  });

  it("shows the closing statement once, under the hero, not beside the close heading", () => {
    render(<MarketingHome />);

    const statement = landingCopy.close.title;
    const bands = [...document.querySelectorAll(".editorial-statement")];
    const closingBand = bands.find((band) =>
      band.textContent?.includes(statement),
    );
    expect(closingBand).toBeDefined();
    expect(closingBand?.previousElementSibling?.id).toBe("hero");
    expect(closingBand?.nextElementSibling?.id).toBe("connect");
    expect(
      bands.filter((band) => band.textContent?.includes(statement)),
    ).toHaveLength(1);
    expect(document.getElementById("close")?.previousElementSibling?.id).toBe(
      "faq",
    );
    expect(
      section("close").getByRole("heading", { level: 2, name: statement }),
    ).toBeVisible();
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
