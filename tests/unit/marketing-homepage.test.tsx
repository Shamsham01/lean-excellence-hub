import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { ThemeProvider } from "@/app/theme-provider";
import { MarketingHome } from "@/components/marketing/home";

describe("public marketing homepage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders one H1 and the connected-system story", () => {
    render(<MarketingHome />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Make continuous improvement visible, accountable and measurable.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /connect frontline observations, actions, problem solving and organisational learning/i,
      ),
    ).toBeInTheDocument();
    for (const name of [
      "One finding. Every next step connected.",
      "Accountability you can see on the floor and on the dashboard.",
      "One connected improvement system.",
      "Context first. Assistance second. You decide.",
      "Straight answers",
      "Your framework. Your standards. Your way of working.",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  it("uses Book a demo and Get free access as hero CTAs, without Sign in", () => {
    render(<MarketingHome />);

    const hero = document.getElementById("connect") as HTMLElement;
    expect(
      within(hero).getByRole("link", { name: "Book a demo" }),
    ).toHaveAttribute("href", "/demo");
    expect(
      within(hero).getByRole("link", { name: "Get free access" }),
    ).toHaveAttribute("href", "/early-access");
    expect(
      within(hero).getByRole("link", { name: /Explore the platform/ }),
    ).toHaveAttribute("href", "#platform");
    expect(within(hero).queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("points every Book a demo at /demo and every Get free access at /early-access", () => {
    render(<MarketingHome />);

    const demo = screen.getAllByRole("link", { name: "Book a demo" });
    expect(demo.length).toBeGreaterThanOrEqual(4);
    for (const link of demo) {
      expect(link).toHaveAttribute("href", "/demo");
    }
    const access = screen.getAllByRole("link", { name: "Get free access" });
    expect(access.length).toBeGreaterThanOrEqual(4);
    for (const link of access) {
      expect(link).toHaveAttribute("href", "/early-access");
    }
    expect(screen.queryAllByText(/book a live demo/i)).toHaveLength(0);
    expect(
      screen.queryAllByRole("link", { name: "Create an account" }),
    ).toHaveLength(0);
  });

  it("keeps every sign-in link on the login route", () => {
    render(<MarketingHome />);

    for (const link of screen.getAllByRole("link", { name: "Sign in" })) {
      expect(link).toHaveAttribute("href", "/login");
    }
  });

  it("has no captions, notes, customer names or prices in the page text", () => {
    const { container } = render(<MarketingHome />);

    expect(container.querySelectorAll("figcaption")).toHaveLength(0);
    const text = container.textContent ?? "";
    const attrs = Array.from(
      container.querySelectorAll("[alt], [aria-label], [title]"),
    )
      .map(
        (el) =>
          `${el.getAttribute("alt") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`,
      )
      .join(" ");
    expect(`${text} ${attrs}`).not.toMatch(/harbourfield/i);
    expect(text).not.toMatch(/£|\$|per month|per site/i);
    expect(text).not.toMatch(/example data|fictional/i);
    expect(JSON.stringify(metadata)).not.toMatch(/harbourfield/i);
  });

  it("renders every product visual as a real capture in both themes", () => {
    const { container } = render(<MarketingHome />);

    const pictures = container.querySelectorAll("main picture.v6-cap");
    expect(pictures.length).toBeGreaterThan(0);
    const light = container.querySelectorAll("main picture.cap-light");
    const dark = container.querySelectorAll("main picture.cap-dark");
    expect(light.length).toBe(dark.length);
    for (const img of container.querySelectorAll("main picture img")) {
      expect(img.getAttribute("src")).toMatch(
        /^\/marketing\/v6\/[a-z0-9-]+-(light|dark)\.webp$/,
      );
      expect(Number(img.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(img.getAttribute("height"))).toBeGreaterThan(0);
      expect(img.getAttribute("alt")).toBeTruthy();
    }
    // No drawn product vignettes on the landing.
    expect(container.querySelector(".marketing-action-card")).toBeNull();
    expect(container.querySelector(".editorial-module")).toBeNull();
  });

  it("tells the evidence-to-impact loop as Observe through Learn tabs", () => {
    render(<MarketingHome />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringMatching(/01Observe/),
      expect.stringMatching(/02Act/),
      expect.stringMatching(/03Solve/),
      expect.stringMatching(/04Improve/),
      expect.stringMatching(/05Learn/),
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[0] as HTMLElement, { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("never ships retired or rejected capture slots", () => {
    const { container } = render(<MarketingHome />);

    const sources = Array.from(
      container.querySelectorAll("main picture img, main picture source"),
    )
      .map((el) => el.getAttribute("src") ?? el.getAttribute("srcset") ?? "")
      .join(" ");
    expect(sources).toMatch(/hero-devices-/);
    expect(sources).toMatch(/action-detail-/);
    expect(sources).not.toMatch(
      /hero-dashboard|step-act-(light|dark|m)|leanai-panel-(light|dark)|tile-projects|tile-pps/,
    );
    // PIXEL round 3: the 390 px phone crops are delivered and wired.
    for (const slot of [
      "step-observe-m",
      "action-detail-m",
      "step-solve-m",
      "step-improve-m",
      "step-learn-m",
      "step-act-list-m",
    ]) {
      expect(sources).toContain(`${slot}-light`);
    }
    expect(container.querySelector("#projects-benefits")).toBeNull();
  });

  it("draws the pillar maturity radar with the real values", () => {
    render(<MarketingHome />);

    expect(
      screen.getByRole("img", { name: "Pillar maturity radar" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows).toEqual([
      "Engineering & Asset Reliability2.8",
      "Health & Safety2.4",
      "Operations2.7",
      "Quality & Technical2.9",
      "People & Leadership2.8",
    ]);
    expect(
      screen.getByLabelText("Overall maturity 2.7 out of 5"),
    ).toBeInTheDocument();
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
    for (const [name, href] of [
      ["Platform", "/#platform"],
      ["Why LEH", "/#why"],
      ["LeanAI", "/#leanai"],
      ["FAQ", "/#faq"],
    ] as const) {
      expect(within(desktopNav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
      expect(document.getElementById(href.slice(2))).not.toBeNull();
    }
  });

  it("keeps footer links on valid homepage anchors and access routes", () => {
    render(<MarketingHome />);

    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "Book a demo" }),
    ).toHaveAttribute("href", "/demo");
    expect(
      within(footer).getByRole("link", { name: "Get free access" }),
    ).toHaveAttribute("href", "/early-access");
    expect(
      within(footer).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(footer).getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(within(footer).getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/#faq",
    );
    expect(
      within(footer).getByText(/© \d{4} Lean Excellence Hub/),
    ).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Mobile" });
    expect(
      within(mobileNav).getByRole("link", { name: "Platform" }),
    ).toHaveAttribute("href", "/#platform");
    fireEvent.click(within(mobileNav).getByRole("link", { name: "LeanAI" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });

  it("answers the FAQ including demo booking and early access", () => {
    render(<MarketingHome />);

    const faq = document.getElementById("faq") as HTMLElement;
    expect(within(faq).getByText(/30-minute walkthrough/i)).toBeInTheDocument();
    expect(
      within(faq).getByText("How do I get early access?"),
    ).toBeInTheDocument();
    expect(
      within(faq).getByText(/how many sites you run/i),
    ).toBeInTheDocument();
  });

  it("tells LeanAI governance without autonomous authority", () => {
    render(<MarketingHome />);

    const leanai = document.getElementById("leanai") as HTMLElement;
    expect(
      within(leanai).getByText(/a person reviews\. a person decides/i),
    ).toBeInTheDocument();
    expect(
      within(leanai).getByText(
        /publishing, closure, access and purchasing stay with a person/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps a static reading path for reduced motion and without JS", () => {
    render(<MarketingHome />);
    const css = readFileSync("src/components/marketing/v6/v6.css", "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation: none/);
    // Reveal only hides content once JS has marked <html class="js">.
    expect(css).toMatch(/html\.js \.leh-v6 \[data-reveal\]/);
    expect(css).not.toMatch(/\n\s*\.leh-v6 \[data-reveal\] \{\s*opacity: 0/);
  });

  it("applies the ATELIER r1 layout rulings", () => {
    const { container } = render(<MarketingHome />);
    // M3: no tagline strip under the hero.
    expect(container.querySelector(".v6-principle")).toBeNull();
    // M1: the statement is two phrases, one per line.
    const lines = Array.from(
      container.querySelectorAll(".v6-statement .v6-mega-line"),
    ).map((el) => el.textContent);
    expect(lines).toEqual(["Operational excellence.", "Connected."]);
    // B4 + r2 m2: nodes beside kickers, the carousel rail, and the close icon.
    const kinds = new Set(
      Array.from(container.querySelectorAll<HTMLElement>("[data-thread]")).map(
        (el) => el.dataset.thread,
      ),
    );
    expect([...kinds].sort()).toEqual(["end", "node", "stub"]);
    // The device mockup is the hero's high-priority LCP image.
    const heroImgs = container.querySelectorAll(".v6-hero-devices img");
    expect(heroImgs.length).toBeGreaterThan(0);
    for (const img of heroImgs) {
      expect(img.getAttribute("loading")).toBe("eager");
      expect(img.getAttribute("fetchpriority")).toBe("high");
    }

    const css = readFileSync("src/components/marketing/v6/v6.css", "utf8");
    // B2: captures are never cropped to fill a window.
    expect(css).not.toMatch(/object-fit:\s*cover/);
    // B4: no thread below 1280.
    expect(css).toMatch(
      /@media \(max-width: 1279px\) \{\s*\.v6-thread \{\s*display: none/,
    );
    // B1: no translucent or 3-D hero layers.
    expect(css).not.toMatch(/preserve-3d|perspective:/);
    // G1 art waits for the page to load.
    expect(css).toMatch(/html\.v6-art \.v6-hero-aurora::before/);
  });

  it("gives every section a transparent background (one page background)", () => {
    const css = readFileSync("src/components/marketing/v6/v6.css", "utf8");
    expect(css).toMatch(/\.v6-page section \{[^}]*background: transparent/);
  });

  it("exposes a labelled System / Light / Dark appearance control", () => {
    render(<MarketingHome />);

    const appearanceTriggers = screen.getAllByRole("button", {
      name: "Appearance: System",
    });
    expect(appearanceTriggers.length).toBeGreaterThan(0);
    for (const trigger of appearanceTriggers) {
      expect(trigger).toHaveAttribute("data-appearance", "system");
    }

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const appearanceGroup = screen.getByRole("group", { name: "Appearance" });
    expect(
      within(appearanceGroup).getByRole("button", { name: "System" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("marketing appearance persistence", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("persists System, Light and Dark through next-themes", async () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableColorScheme
        enableSystem
      >
        <MarketingHome />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const appearanceGroup = screen.getByRole("group", { name: "Appearance" });

    fireEvent.click(
      within(appearanceGroup).getByRole("button", { name: "Dark" }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("dark");
    });

    fireEvent.click(
      within(appearanceGroup).getByRole("button", { name: "Light" }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("light");
    });

    fireEvent.click(
      within(appearanceGroup).getByRole("button", { name: "System" }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("system");
    });
  });

  it("switches the header icon and accessible label with the setting", async () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableColorScheme
        enableSystem
      >
        <MarketingHome />
      </ThemeProvider>,
    );

    const banner = screen.getByRole("banner");
    const trigger = () =>
      within(banner).getByRole("button", { name: /^Appearance: / });

    expect(trigger()).toHaveAccessibleName("Appearance: System");
    expect(trigger().querySelector("svg.lucide-monitor")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const appearanceGroup = screen.getByRole("group", { name: "Appearance" });

    const cases = [
      { choice: "Dark", icon: "lucide-moon" },
      { choice: "Light", icon: "lucide-sun" },
      { choice: "System", icon: "lucide-monitor" },
    ] as const;

    for (const { choice, icon } of cases) {
      fireEvent.click(
        within(appearanceGroup).getByRole("button", { name: choice }),
      );
      await waitFor(() => {
        expect(trigger()).toHaveAccessibleName(`Appearance: ${choice}`);
      });
      expect(trigger()).toHaveAttribute(
        "data-appearance",
        choice.toLowerCase(),
      );
      expect(trigger().querySelectorAll("svg")).toHaveLength(1);
      expect(trigger().querySelector(`svg.${icon}`)).not.toBeNull();
      expect(
        within(appearanceGroup).getByRole("button", { name: choice }),
      ).toHaveAttribute("aria-pressed", "true");
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
        name: "Make continuous improvement visible, accountable and measurable.",
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
    expect(css).toContain("grid-template-areas");
    expect(css).not.toContain("masonry");
    expect(css).toContain("color-scheme: light dark");
    expect(css).toContain("--warning-foreground: oklch(0.28 0.06 75)");
  });

  it("keeps the sticky header bound to the viewport when scroll is locked", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const appearance = readFileSync(
      "src/components/marketing/appearance-menu.tsx",
      "utf8",
    );
    const header = readFileSync("src/components/marketing/header.tsx", "utf8");

    expect(css).toMatch(
      /html:has\(> body > \.marketing\) \{\s*overflow-x: visible;\s*\}/,
    );
    expect(css).toMatch(
      /\.marketing \{\s*overflow-anchor: none;\s*overflow-x: clip;\s*\}/,
    );
    expect(css).toMatch(/\.marketing-header \{\s*position: sticky;\s*top: 0;/);
    expect(css).not.toMatch(/\.marketing-header \{[^}]*position: fixed/);
    expect(css).toContain("scroll-state(stuck: top)");
    expect(appearance).toContain("<DropdownMenu modal={false}>");
    expect(header).toContain("marketing-mobile-panel");
    expect(css).toMatch(/\.marketing-mobile-panel \{\s*position: absolute;/);
  });

  it("scopes the LEH palette and mixes marketing colours in oklab", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const start = css.indexOf("/* Marketing homepage primitives");
    const end = css.indexOf("\n.leh-progress {");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const marketing = css.slice(start, end);

    expect(marketing).toContain(".marketing,\n.marketing-appearance-menu {");
    expect(marketing).toMatch(/--leh-accent: #465fff/);
    expect(marketing).toMatch(/--leh-canvas-light: #f8fafc/);
    expect(marketing).toMatch(/--leh-canvas-dark: #090e17/);
    expect(marketing).toContain("--primary: var(--leh-accent);");
    expect(marketing).not.toContain("color-mix(in oklch");
    expect(marketing).toContain("color-mix(in oklab");
    expect(marketing).not.toMatch(/\bfrom var\(/);

    const primitives = readFileSync(
      "src/components/marketing/primitives.tsx",
      "utf8",
    );
    expect(primitives).not.toContain("in_oklch");
  });

  it("reuses next-themes instead of a parallel marketing theme store", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const appearance = readFileSync(
      "src/components/marketing/appearance-menu.tsx",
      "utf8",
    );
    expect(layout).toContain('defaultTheme="system"');
    expect(layout).toContain("enableSystem");
    expect(layout).toContain("enableColorScheme");
    expect(layout).toContain('colorScheme: "light dark"');
    expect(appearance).toContain('from "next-themes"');
    expect(appearance).toContain("useTheme");
    expect(appearance).not.toContain("localStorage.setItem");
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
