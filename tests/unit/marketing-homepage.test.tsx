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
        name: "Experience improvement, not another product tour.",
      }),
    ).toBeInTheDocument();
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

    const tryLinks = screen.getAllByRole("link", { name: "Try LEH" });
    expect(tryLinks.length).toBeGreaterThan(0);
    expect(screen.queryByText(/£49|\$49|49\/month/i)).not.toBeInTheDocument();
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
      within(footer).getByRole("link", { name: "Actions" }),
    ).toHaveAttribute("href", "/#actions");
    expect(
      within(footer).getByText(/© 2026 Lean Excellence Hub/),
    ).toBeInTheDocument();
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

  it("uses an editorial platform grid order rather than masonry", () => {
    render(<MarketingHome />);

    const platform = document.getElementById("platform");
    expect(platform).toBeTruthy();
    const titles = [
      ...platform!.querySelectorAll(".marketing-preview-title"),
    ].map((node) => node.textContent);
    expect(titles).toEqual([
      "Maturity",
      "Gemba",
      "5S",
      "Suggestions",
      "Actions",
      "Problem Solving",
      "Projects & Benefits",
      "Training & Skills",
    ]);

    expect(document.getElementById("maturity")).toHaveClass(
      "marketing-platform-maturity",
    );
    expect(document.getElementById("gemba")).toHaveClass(
      "marketing-platform-gemba",
    );
    expect(document.getElementById("actions")).toHaveClass(
      "marketing-platform-actions",
    );
  });

  it("keeps one platform disclosure instead of repeating illustrative captions", () => {
    render(<MarketingHome />);

    expect(
      screen.getByText(
        /product previews use illustrative example records\. they are not customer performance data/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /product previews use illustrative example records\. they are not customer performance data/i,
      ),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        "Observations become owned follow-up in the same system.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/highlighted cells are not actual site scores/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/forecast and realisation stay separate/i),
    ).toBeInTheDocument();
  });

  it("shows disconnected operational fragments rather than generic labels", () => {
    render(<MarketingHome />);

    expect(screen.getByText("Audit checklist")).toBeInTheDocument();
    expect(screen.getByText("Email thread")).toBeInTheDocument();
    expect(screen.getByText("Standalone form")).toBeInTheDocument();
    expect(screen.getByText("Slide deck")).toBeInTheDocument();
    expect(screen.queryAllByText(/\bexcel\b|\bpowerpoint\b/i)).toHaveLength(0);
    expect(
      screen.queryByAltText(/excel|microsoft|teams/i),
    ).not.toBeInTheDocument();
  });

  it("groups the fragments by loop stage and resolves each into one LEH strip", () => {
    render(<MarketingHome />);

    const problem = document.getElementById("why") as HTMLElement;
    const stages = [
      ...problem.querySelectorAll(".marketing-fragments-stage"),
    ] as HTMLElement[];
    expect(stages).toHaveLength(4);
    for (const stage of stages) {
      expect(stage.querySelectorAll(".marketing-artefact")).toHaveLength(2);
      expect(
        stage.querySelector(".marketing-fragments-resolve"),
      ).not.toBeNull();
    }
    expect(
      stages.map(
        (stage) =>
          stage.querySelector(".marketing-fragments-stage-name")?.textContent,
      ),
    ).toEqual(["Observe", "Act", "Improve", "Learn"]);
    expect(
      within(problem).getByText("Findings retyped into actions"),
    ).toBeInTheDocument();
    expect(
      within(problem).getByText("Forecast, never validated"),
    ).toBeInTheDocument();
    expect(within(problem).queryAllByRole("heading", { level: 3 })).toEqual([]);
  });

  it("renders the evidence-to-impact journey as one connected ribbon", () => {
    render(<MarketingHome />);

    const journey = document.getElementById("impact") as HTMLElement;
    const steps = [
      ...journey.querySelectorAll(".marketing-process-step"),
    ] as HTMLElement[];
    expect(steps).toHaveLength(5);
    for (const step of steps) {
      expect(step.querySelector(".marketing-process-node")).not.toBeNull();
      expect(step.querySelector(".marketing-process-record")).not.toBeNull();
      expect(
        step.querySelector(".marketing-process-state .marketing-chip"),
      ).not.toBeNull();
    }
    expect(journey.querySelectorAll(".marketing-process-rail")).toHaveLength(1);
    expect(
      within(journey).getByText("Learning feeds the next walk."),
    ).toBeInTheDocument();
    expect(within(journey).getByText("Due Friday")).toHaveClass(
      "marketing-chip-warning",
    );
    expect(within(journey).getByText("Connected")).toHaveClass(
      "marketing-chip-connected",
    );
  });

  it("presents one system through scoped perspectives instead of four cards", () => {
    render(<MarketingHome />);

    const audience = document.getElementById("audience") as HTMLElement;
    expect(
      within(audience).getByRole("heading", {
        level: 2,
        name: "One system. Different perspectives.",
      }),
    ).toBeInTheDocument();

    const tablist = within(audience).getByRole("tablist", {
      name: "Perspectives",
    });
    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      within(audience).getByText(
        "Where is the system maturing, and where is it drifting?",
      ),
    ).toBeInTheDocument();
    expect(within(audience).getAllByRole("tabpanel")).toHaveLength(1);

    const siteTab = within(tablist).getByRole("tab", {
      name: /site leadership/i,
    });
    fireEvent.mouseDown(siteTab);
    expect(siteTab).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    const panel = within(audience).getByRole("tabpanel");
    expect(
      within(panel).getByText("What needs attention at this site this week?"),
    ).toBeInTheDocument();
    expect(within(panel).getByText("North plant")).toBeInTheDocument();
    expect(
      within(audience).queryByText(
        "Where is the system maturing, and where is it drifting?",
      ),
    ).not.toBeInTheDocument();
    expect(audience.querySelector(".marketing-audience")).toBeNull();
  });

  it("exposes a labelled System / Light / Dark appearance control", () => {
    render(<MarketingHome />);

    const appearanceTriggers = screen.getAllByRole("button", {
      name: "Appearance: System",
    });
    expect(appearanceTriggers.length).toBeGreaterThan(0);
    for (const trigger of appearanceTriggers) {
      expect(trigger).toHaveAttribute("data-appearance", "system");
      expect(trigger.querySelector("svg.lucide-monitor")).not.toBeNull();
    }

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const appearanceGroup = screen.getByRole("group", { name: "Appearance" });
    expect(
      within(appearanceGroup).getByRole("button", { name: "System" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(appearanceGroup).getByRole("button", { name: "Light" }),
    ).toBeInTheDocument();
    expect(
      within(appearanceGroup).getByRole("button", { name: "Dark" }),
    ).toBeInTheDocument();
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
    expect(css).toContain("grid-template-areas");
    expect(css).not.toContain("masonry");
    expect(css).toContain("color-scheme: light dark");
    expect(css).toContain("--warning-foreground: oklch(0.88 0.08 80)");
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
    expect(css).toMatch(/\.marketing \{\s*overflow-x: clip;\s*\}/);
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
    expect(marketing).toMatch(/--leh-cobalt: oklch\(/);
    expect(marketing).toMatch(/--leh-teal: oklch\(/);
    expect(marketing).toContain("--primary: var(--leh-cobalt);");
    expect(marketing).not.toContain("color-mix(in oklch");
    expect(marketing).toContain("color-mix(in oklab");
    expect(marketing).not.toMatch(/#[0-9a-f]{3,8}\b/i);
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
