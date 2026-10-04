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
import { MarketingHome } from "@/components/marketing/home";

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
        /run your entire continuous improvement system in one place/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("From signal to measurable improvement"),
    ).toBeInTheDocument();
    expect(screen.getByText("Observation identified")).toBeInTheDocument();
    expect(screen.getByText("£48,600 annualised")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "One connected improvement system.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "An AI assistant that understands your improvement system.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/leh supplies the engine, not the doctrine/i),
    ).toBeInTheDocument();
  });

  it("keeps sign-in on the login route and explore CTAs on in-page anchors", () => {
    render(<MarketingHome />);

    const signInLinks = screen.getAllByRole("link", { name: "Sign in" });
    expect(signInLinks.length).toBeGreaterThan(0);
    for (const link of signInLinks) {
      expect(link).toHaveAttribute("href", "/login");
    }

    const exploreLinks = screen.getAllByRole("link", {
      name: "Explore the platform",
    });
    expect(exploreLinks.length).toBeGreaterThan(0);
    for (const link of exploreLinks) {
      expect(link).toHaveAttribute("href", "#platform");
    }

    expect(
      screen.getByRole("link", { name: "Explore Lean Excellence Hub" }),
    ).toHaveAttribute("href", "#platform");
  });

  it("does not offer a fake demo-booking workflow", () => {
    render(<MarketingHome />);

    const demoButtons = screen.getAllByRole("button", { name: "Book a demo" });
    expect(demoButtons.length).toBeGreaterThan(0);
    for (const button of demoButtons) {
      expect(button).toBeDisabled();
    }
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /book a demo/i }),
    ).not.toBeInTheDocument();
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
    ).toHaveAttribute("href", "#platform");
    expect(
      within(desktopNav).getByRole("link", { name: "Why LEH" }),
    ).toHaveAttribute("href", "#why");
    expect(
      within(desktopNav).getByRole("link", { name: "LeanAI" }),
    ).toHaveAttribute("href", "#leanai");
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
    ).toHaveAttribute("href", "#platform");

    fireEvent.click(within(mobileNav).getByRole("link", { name: "LeanAI" }));
    expect(
      screen.queryByRole("navigation", { name: "Mobile" }),
    ).not.toBeInTheDocument();
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
