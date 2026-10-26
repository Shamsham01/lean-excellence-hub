/**
 * Public Cal.com booking link for /demo.
 *
 * The embed uses Cal.com's official inline snippet (`/embed/embed.js`).
 * Cal.com remains the system of record for availability, confirmation,
 * cancellation and rescheduling. This module does not calculate slots
 * and does not accept a client-side embed event as proof of a booking.
 *
 * Approved hosts are cal.com and cal.eu, including their subdomains
 * (for example app.cal.com). A custom domain is rejected until it is
 * added here, so a mis-set environment variable cannot point the iframe
 * at an arbitrary site.
 */

const APPROVED_SUFFIXES = ["cal.com", "cal.eu"] as const;

const RESERVED_FIRST_SEGMENTS = new Set([
  "_next",
  "api",
  "apps",
  "auth",
  "docs",
  "embed",
  "help",
  "login",
  "privacy",
  "settings",
  "signup",
  "terms",
]);

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

export const DEMO_EMBED_NAMESPACE = "leh-demo";

export const DEMO_BOOKING_CTA = "Book a live demo";

/**
 * Playwright sends this header only when `DEMO_BOOKING_E2E=1`.
 * Production ignores it. The value still has to pass the host allowlist.
 */
export const DEMO_BOOKING_E2E_HEADER = "x-leh-e2e-demo-booking-url";

export type DemoBookingReady = {
  status: "ready";
  pageUrl: string;
  origin: string;
  calLink: string;
  embedScriptUrl: string;
};

export type DemoBookingState =
  { status: "unconfigured" } | { status: "invalid" } | DemoBookingReady;

export type DemoEmbedTheme = "light" | "dark";

export function readDemoBooking(
  raw: string | undefined = process.env.NEXT_PUBLIC_DEMO_BOOKING_URL,
): DemoBookingState {
  return resolveDemoBookingUrl(raw);
}

/**
 * A non-empty override replaces the published URL. An empty override
 * keeps the published URL. Both paths use the same allowlist.
 */
export function readDemoBookingOverride(
  override: string | null | undefined,
  published: string | undefined = process.env.NEXT_PUBLIC_DEMO_BOOKING_URL,
): DemoBookingState {
  const value = override?.trim() ?? "";
  if (!value) return readDemoBooking(published);
  return resolveDemoBookingUrl(value);
}

export function resolveDemoBookingUrl(
  raw: string | undefined | null,
): DemoBookingState {
  const value = raw?.trim() ?? "";
  if (!value) return { status: "unconfigured" };
  if (value.length > 300) return { status: "invalid" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { status: "invalid" };
  }

  if (url.protocol !== "https:") return { status: "invalid" };
  if (url.username || url.password) return { status: "invalid" };
  if (url.port) return { status: "invalid" };

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!isApprovedHost(host)) return { status: "invalid" };

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 1 || segments.length > 4) return { status: "invalid" };

  const decoded: string[] = [];
  for (const segment of segments) {
    let valueSegment: string;
    try {
      valueSegment = decodeURIComponent(segment);
    } catch {
      return { status: "invalid" };
    }
    if (
      valueSegment !== segment ||
      valueSegment.includes("/") ||
      valueSegment.includes("\\") ||
      valueSegment === "." ||
      valueSegment === ".." ||
      !SEGMENT.test(valueSegment)
    ) {
      return { status: "invalid" };
    }
    decoded.push(valueSegment);
  }

  const first = decoded[0];
  if (!first || RESERVED_FIRST_SEGMENTS.has(first.toLowerCase())) {
    return { status: "invalid" };
  }

  const origin = canonicalOrigin(host);
  const calLink = decoded.join("/");

  return {
    status: "ready",
    pageUrl: `${origin}/${calLink}`,
    origin,
    calLink,
    embedScriptUrl: `${origin}/embed/embed.js`,
  };
}

export function demoEmbedConfig(theme: DemoEmbedTheme) {
  return {
    layout: "month_view" as const,
    theme,
    useSlotsViewOnSmallScreen: "true" as const,
    iframeAttrs: {
      title:
        "Cal.com booking calendar for a Lean Excellence Hub product demonstration",
    },
  };
}

export function demoEmbedUi(theme: DemoEmbedTheme) {
  return {
    hideEventTypeDetails: false,
    layout: "month_view" as const,
    theme,
    disableAutoScroll: true,
  };
}

function isApprovedHost(host: string) {
  return APPROVED_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function canonicalOrigin(host: string) {
  if (host === "www.cal.com") return "https://cal.com";
  if (host === "www.cal.eu") return "https://cal.eu";
  return `https://${host}`;
}
