import type { ReactNode } from "react";
import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_EMBED_LOAD_TIMEOUT_MS } from "@/components/marketing/demo/booking-calendar";
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
  delete (window as Window & { Cal?: unknown }).Cal;
  for (const script of document.head.querySelectorAll("script")) {
    if (script.src.includes("/embed/embed.js")) script.remove();
  }
});

/**
 * Stands in for `/embed/embed.js` after the stub has queued its commands.
 * Replaces `window.Cal` the way the real script does, and does not clear
 * any one-time mount guard.
 */
function adoptEmbedQueue() {
  const stub = (
    window as Window & {
      Cal?: {
        q?: unknown[][];
        ns?: Record<string, { q?: unknown[][] } | undefined>;
      };
    }
  ).Cal;
  const namespaces: Record<string, (...args: unknown[]) => void> = {};

  const handle = (args: unknown[]) => {
    if (args[0] === "init" && typeof args[1] === "string") {
      const name = args[1];
      if (!namespaces[name]) {
        namespaces[name] = (...nested: unknown[]) => handle(nested);
      }
      return;
    }
    if (args[0] === "inline") {
      const options = args[1] as { elementOrSelector?: HTMLElement };
      const element = options?.elementOrSelector;
      if (!element) return;
      const frame = document.createElement("iframe");
      frame.setAttribute("data-leh-mock-embed", "");
      element.appendChild(frame);
      return;
    }
    if (args[0] === "on") {
      const spec = args[1] as { action?: string; callback?: () => void };
      if (spec?.action === "linkReady") spec.callback?.();
    }
  };

  const cal = ((...args: unknown[]) => {
    handle(args);
  }) as {
    (...args: unknown[]): void;
    ns: Record<string, (...args: unknown[]) => void>;
    q: unknown[][];
    loaded: boolean;
  };
  cal.ns = namespaces;
  cal.q = [];
  cal.loaded = true;

  const pending: unknown[][] = [];
  if (stub?.q) pending.push(...stub.q);
  if (stub?.ns) {
    for (const api of Object.values(stub.ns)) {
      if (api?.q) pending.push(...api.q);
    }
  }
  (window as Window & { Cal?: unknown }).Cal = cal;
  for (const args of pending) handle(args);
}

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
    expect(
      screen.getByRole("heading", { name: "Booking and privacy" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/has not published a privacy policy/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/business email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/operational sites/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/job role/i)).not.toBeInTheDocument();
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

  it("mounts a new calendar after unmount without clearing embed memory", async () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    const first = render(<MarketingDemoPage booking={FIXTURE} />);
    await waitFor(() => {
      expect(
        document.head.querySelector('script[src*="embed.js"]'),
      ).not.toBeNull();
    });

    act(() => {
      adoptEmbedQueue();
    });
    expect(document.querySelectorAll(".demo-embed iframe")).toHaveLength(1);

    first.unmount();
    expect(document.querySelector(".demo-embed")).toBeNull();
    expect((window as Window & { Cal?: unknown }).Cal).toBeTypeOf("function");

    render(<MarketingDemoPage booking={FIXTURE} />);

    await waitFor(() => {
      expect(document.querySelectorAll(".demo-embed iframe")).toHaveLength(1);
    });
    expect(document.querySelector(".demo-embed iframe")).toHaveAttribute(
      "data-leh-mock-embed",
      "",
    );
  });

  it("keeps a single frame when Strict Mode queues two inline commands", async () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    render(
      <StrictMode>
        <MarketingDemoPage booking={FIXTURE} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(
        document.head.querySelector('script[src*="embed.js"]'),
      ).not.toBeNull();
    });

    act(() => {
      adoptEmbedQueue();
    });

    await waitFor(() => {
      expect(document.querySelectorAll(".demo-embed iframe")).toHaveLength(1);
    });
  });

  it("stops saying Loading when the embed script fails", () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    render(<MarketingDemoPage booking={FIXTURE} />);
    const script = document.head.querySelector('script[src*="embed.js"]');
    expect(script).not.toBeNull();

    act(() => {
      script?.dispatchEvent(new Event("error"));
    });

    expect(screen.getByText(/did not load/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Loading the calendar from Cal\.com/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the booking page" }),
    ).toHaveAttribute("href", FIXTURE.pageUrl);
    expect((window as Window & { Cal?: unknown }).Cal).toBeUndefined();
  });

  it("requests the embed again on the next mount after a script error", async () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    const first = render(<MarketingDemoPage booking={FIXTURE} />);
    const script = document.head.querySelector('script[src*="embed.js"]');
    act(() => {
      script?.dispatchEvent(new Event("error"));
    });
    first.unmount();

    render(<MarketingDemoPage booking={FIXTURE} />);

    await waitFor(() => {
      expect(
        document.head.querySelector(
          'script[src="https://cal.com/embed/embed.js"]:not([data-leh-embed-status="error"])',
        ),
      ).not.toBeNull();
    });

    const cal = (
      window as Window & {
        Cal?: { ns?: Record<string, { q?: unknown[][] }> };
      }
    ).Cal;
    expect(cal?.ns?.["leh-demo"]?.q?.some((args) => args[0] === "inline")).toBe(
      true,
    );
    expect(
      screen.getByRole("link", { name: "Open the booking page" }),
    ).toBeInTheDocument();
  });

  it("stops saying Loading when the embed script never finishes", async () => {
    expect(FIXTURE.status).toBe("ready");
    if (FIXTURE.status !== "ready") return;

    vi.useFakeTimers();
    try {
      render(<MarketingDemoPage booking={FIXTURE} />);
      expect(
        screen.getByText(/Loading the calendar from Cal\.com/i),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEMO_EMBED_LOAD_TIMEOUT_MS);
      });

      expect(screen.getByText(/did not load/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/Loading the calendar from Cal\.com/i),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Open the booking page" }),
      ).toHaveAttribute("href", FIXTURE.pageUrl);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the page free of scroll-hijacking motion", () => {
    const css = readFileSync("src/components/marketing/demo/demo.css", "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("scroll-timeline");
    expect(css).not.toContain("animation:");
    expect(css).not.toContain("position: fixed");
  });
});
