import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
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
import { MarketingDemoPage, MarketingHome } from "@/components/marketing/home";

describe("public marketing homepage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the hero, connected-system story and commercial CTAs", () => {
    render(<MarketingHome />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Operational excellence. Connected.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /connect frontline evidence to owned action, structured solving/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("From signal to measurable improvement"),
    ).toBeInTheDocument();
    expect(screen.getByText("Observation identified")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "One connected improvement system.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Context, assistance, then a person decides.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/leh supplies the engine, not the doctrine/i),
    ).toBeInTheDocument();
  });

  it("uses Request a demo as the primary CTA and keeps explore in-page", () => {
    render(<MarketingHome />);

    const demoLinks = screen.getAllByRole("link", { name: "Request a demo" });
    expect(demoLinks.length).toBeGreaterThan(0);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute("href", "/demo");
    }

    const exploreLinks = screen.getAllByRole("link", {
      name: "Explore the platform",
    });
    expect(exploreLinks.length).toBeGreaterThan(0);
    for (const link of exploreLinks) {
      expect(link).toHaveAttribute("href", "#platform");
    }

    expect(
      screen.queryByRole("button", { name: /book a demo/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("keeps sign-in on the login route and out of the hero CTA pair", () => {
    render(<MarketingHome />);

    const signInLinks = screen.getAllByRole("link", { name: "Sign in" });
    expect(signInLinks.length).toBeGreaterThan(0);
    for (const link of signInLinks) {
      expect(link).toHaveAttribute("href", "/login");
    }

    const hero = screen
      .getByRole("heading", {
        name: "Operational excellence. Connected.",
      })
      .closest("section");
    expect(hero).toBeTruthy();
    expect(
      within(hero as HTMLElement).queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("renders LEH-native platform previews instead of generic module slogans", () => {
    render(<MarketingHome />);

    expect(
      screen.getByText("Pallet labels not at point of use after changeover."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ACT-1042 · Restore point-of-use labels"),
    ).toBeInTheDocument();
    expect(screen.getByText("5 pillars")).toBeInTheDocument();
    expect(screen.getByText("60 scored questions")).toBeInTheDocument();
    expect(
      screen.getByText(
        "SUG-018 · Move changeover kit to the line-side cupboard.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/methodology-neutral stages/i)).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /example skills matrix/i }),
    ).toBeInTheDocument();
  });

  it("tells the evidence-to-impact loop as Observe through Learn", () => {
    render(<MarketingHome />);

    expect(
      screen.getByRole("heading", { name: "Observe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Act" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Solve" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Improve" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learn" })).toBeInTheDocument();
  });

  it("exposes restrained in-page navigation without dead destinations", () => {
    render(<MarketingHome />);

    const banner = screen.getByRole("banner");
    expect(
      within(banner).getByRole("link", { name: "Lean Excellence Hub home" }),
    ).toHaveAttribute("href", "/");

    const desktopNav = within(banner).getByRole("navigation", {
      name: "Primary",
    });
    expect(
      within(desktopNav).getByRole("link", { name: "Platform" }),
    ).toHaveAttribute("href", "/#platform");
    expect(
      within(desktopNav).getByRole("link", { name: "Why LEH" }),
    ).toHaveAttribute("href", "/#why");
    expect(
      within(desktopNav).getByRole("link", { name: "LeanAI" }),
    ).toHaveAttribute("href", "/#leanai");
  });

  it("keeps footer links on valid homepage anchors and access routes", () => {
    render(<MarketingHome />);

    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "Request a demo" }),
    ).toHaveAttribute("href", "/demo");
    expect(
      within(footer).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(within(footer).getByRole("link", { name: "Gemba" })).toHaveAttribute(
      "href",
      "/#gemba",
    );
    expect(
      within(footer).queryByRole("link", { name: /privacy|terms|company/i }),
    ).not.toBeInTheDocument();
  });

  it("makes the skip-link target focusable", () => {
    render(<MarketingHome />);

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
    expect(document.getElementById("main")).toHaveAttribute("tabindex", "-1");
  });

  it("opens and closes the mobile menu", () => {
    render(<MarketingHome />);

    expect(
      screen.queryByRole("navigation", { name: "Mobile" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Mobile" });
    expect(mobileNav).toBeVisible();
    expect(
      within(mobileNav).getByRole("link", { name: "Platform" }),
    ).toHaveAttribute("href", "/#platform");

    fireEvent.click(within(mobileNav).getByRole("link", { name: "LeanAI" }));
    expect(
      screen.queryByRole("navigation", { name: "Mobile" }),
    ).not.toBeInTheDocument();
  });
});

describe("request a demo page", () => {
  afterEach(() => {
    cleanup();
  });

  it("explains the demo without inventing booking or an email address", () => {
    render(<MarketingDemoPage />);

    expect(
      screen.getByRole("heading", {
        name: /see how lean excellence hub can connect your continuous improvement system/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /not yet connected to a scheduling or inbox destination/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore the platform" }),
    ).toHaveAttribute("href", "/#platform");
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
        name: "Operational excellence. Connected.",
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

  it("keeps marketing motion on CSS with reduced-motion fallbacks", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("animation-timeline: view()");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("prefers-reduced-motion: no-preference");
    expect(css).toContain("content-visibility: auto");
    expect(css).not.toContain("gsap");
    expect(css).not.toContain("framer-motion");
  });

  it("keeps the page-level auth gate and public metadata", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");
    expect(source).toContain("routeAfterAuthentication");
    expect(source).toContain("createServerSupabaseClient");
    expect(source).toContain("getClaims");
    expect(metadata.title).toBe(
      "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
    );
    expect(metadata.description).toMatch(
      /connected Operational Excellence platform/i,
    );
  });
});
