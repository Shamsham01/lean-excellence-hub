import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetDemoBookingEmbedState } from "@/components/marketing/demo/booking-calendar";
import { MarketingDemoPage } from "@/components/marketing/demo/demo-page";
import { resolveDemoBookingUrl } from "@/lib/marketing/demo-booking";

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

const FIXTURE = resolveDemoBookingUrl(
  "https://cal.com/fixture-organiser/product-demonstration",
);

afterEach(() => {
  cleanup();
  resetDemoBookingEmbedState();
  delete (window as Window & { Cal?: unknown }).Cal;
  for (const script of document.head.querySelectorAll("script")) {
    if (script.src.includes("/embed/embed.js")) script.remove();
  }
});

describe("demo booking page", () => {
  it("explains the walkthrough without inventing times when unconfigured", () => {
    render(<MarketingDemoPage booking={{ status: "unconfigured" }} />);

    expect(
      screen.getByRole("heading", {
        name: "See operational excellence connected.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Live booking is not connected" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not show sample times/i)).toBeInTheDocument();
    expect(
      screen.getByText(/cannot be reserved here yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open the booking page" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector('script[src*="embed.js"]')).toBeNull();
    expect(screen.queryByText("09:00")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/you are booked|booking confirmed/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    const article = screen.getByRole("article");
    expect(
      within(article).getByRole("link", { name: "Explore the platform" }),
    ).toHaveAttribute("href", "/#platform");
    expect(
      within(article).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("link", { name: "Cal.com privacy notice" }),
    ).toHaveAttribute("href", "https://cal.com/privacy");
  });

  it("does not echo an invalid scheduling address", () => {
    render(<MarketingDemoPage booking={{ status: "invalid" }} />);

    expect(
      screen.getByRole("heading", { name: "Scheduling link is not usable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not an approved Cal\.com booking link/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/evil\.example|secret/i)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open the booking page" }),
    ).not.toBeInTheDocument();
  });

  it("mounts the official embed and a direct booking link when configured", async () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    render(<MarketingDemoPage booking={FIXTURE} />);

    expect(
      screen.getByRole("link", { name: "Open the booking page" }),
    ).toHaveAttribute("href", FIXTURE.pageUrl);
    expect(
      screen.getByText(/Loading the calendar from Cal\.com/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/you are booked|booking confirmed/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("09:00")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        document.head.querySelector(
          'script[src="https://cal.com/embed/embed.js"]',
        ),
      ).not.toBeNull();
    });

    const cal = (
      window as Window & {
        Cal?: { q: unknown[][]; ns: Record<string, { q: unknown[][] }> };
      }
    ).Cal;
    const commands = [...(cal?.q ?? []), ...(cal?.ns["leh-demo"]?.q ?? [])];
    expect(commands.some((args) => args[0] === "initNamespace")).toBe(true);
    const inline = commands.find((args) => args[0] === "inline");
    expect(inline?.[1]).toMatchObject({
      calLink: "fixture-organiser/product-demonstration",
    });
    const actions = commands
      .filter((args) => args[0] === "on")
      .map((args) => (args[1] as { action?: string }).action);
    expect(actions).toEqual(
      expect.arrayContaining(["linkFailed", "linkReady"]),
    );
    expect(actions).not.toContain("bookingSuccessful");
  });

  it("keeps the page free of scroll-hijacking motion", () => {
    const css = readFileSync("src/components/marketing/demo/demo.css", "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("scroll-timeline");
    expect(css).not.toContain("animation:");
    expect(css).not.toContain("position: fixed");
  });
});
