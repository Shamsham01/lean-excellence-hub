"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  DEMO_EMBED_NAMESPACE,
  demoEmbedConfig,
  demoEmbedUi,
  type DemoBookingReady,
  type DemoEmbedTheme,
} from "@/lib/marketing/demo-booking";

type CalFn = {
  (...args: unknown[]): void;
  ns: Record<string, CalFn>;
  q: unknown[][];
  loaded?: boolean;
};

const inlineStarted = new Set<string>();

/** Clears the one-time inline guard. Unit tests call this between renders. */
export function resetDemoBookingEmbedState() {
  inlineStarted.clear();
}

/**
 * Official Cal.com inline embed.
 *
 * The snippet queues instructions until `/embed/embed.js` loads. Times,
 * timezone and daylight-saving behaviour come from Cal.com. `linkReady`
 * and `linkFailed` only describe whether the frame loaded. Booking,
 * reschedule and cancel events are intentionally not handled: an embed
 * callback is not confirmation, and Cal.com's own screen remains the
 * confirmation the visitor sees.
 */
export function DemoBookingCalendar({
  booking,
}: {
  booking: DemoBookingReady;
}) {
  const headingId = useId();
  const mountRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<DemoEmbedTheme | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const inlineKey = `${booking.origin}/${booking.calLink}`;

  useEffect(() => {
    const apply = () => setTheme(resolvedTheme());
    apply();
    const root = document.documentElement;
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    const stopScheme = watchColorScheme(apply);
    return () => {
      observer.disconnect();
      stopScheme();
    };
  }, []);

  useEffect(() => {
    if (!theme) return;
    const element = mountRef.current;
    if (!element) return;

    const cal = installCalEmbed(booking.embedScriptUrl);
    if (!inlineStarted.has(inlineKey)) {
      inlineStarted.add(inlineKey);
      cal("init", DEMO_EMBED_NAMESPACE, { origin: booking.origin });
      const api = cal.ns[DEMO_EMBED_NAMESPACE];
      api?.("inline", {
        elementOrSelector: element,
        calLink: booking.calLink,
        config: demoEmbedConfig(theme),
      });
      api?.("on", {
        action: "linkFailed",
        callback: () => setPhase("failed"),
      });
      api?.("on", {
        action: "linkReady",
        callback: () => setPhase("ready"),
      });
    }

    cal.ns[DEMO_EMBED_NAMESPACE]?.("ui", demoEmbedUi(theme));
  }, [
    booking.calLink,
    booking.embedScriptUrl,
    booking.origin,
    inlineKey,
    theme,
  ]);

  const status =
    phase === "failed"
      ? "The Cal.com calendar did not load. Open the booking page to choose a time. This page has not confirmed a meeting."
      : phase === "ready"
        ? "Times below come from Cal.com and use your local timezone, including daylight-saving changes. Choosing a time does not confirm the meeting until Cal.com says it is booked."
        : "Loading the calendar from Cal.com. No times are shown until the provider responds.";

  return (
    <section
      className="demo-calendar"
      aria-labelledby={headingId}
      aria-busy={phase === "loading"}
      data-booking-state="ready"
    >
      <div className="demo-calendar-intro">
        <h2 id={headingId}>Choose a time</h2>
        <p>
          Availability is Cal.com&apos;s. Lean Excellence Hub does not store a
          second copy of the booking.
        </p>
        <a className="demo-external" href={booking.pageUrl}>
          Open the booking page
        </a>
      </div>
      <p className="demo-calendar-status" role="status">
        {status}
      </p>
      <div ref={mountRef} className="demo-embed" />
      <noscript>
        <p>
          The embedded calendar needs JavaScript. Open the booking page to
          choose a time.
        </p>
      </noscript>
    </section>
  );
}

function resolvedTheme(): DemoEmbedTheme {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  if (typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function watchColorScheme(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function installCalEmbed(embedJsUrl: string): CalFn {
  const root = window as Window & { Cal?: CalFn };
  if (root.Cal) return root.Cal;

  const push = (api: CalFn, args: unknown[]) => {
    api.q.push(args);
  };

  const cal = function calFn(...args: unknown[]) {
    const current = root.Cal ?? cal;
    if (!current.loaded) {
      current.ns = current.ns ?? {};
      current.q = current.q ?? [];
      const script = document.createElement("script");
      script.src = embedJsUrl;
      script.async = true;
      document.head.appendChild(script);
      current.loaded = true;
    }

    if (args[0] === "init") {
      const namespace = args[1];
      if (typeof namespace === "string") {
        if (!current.ns[namespace]) {
          const queue: unknown[][] = [];
          const api = ((...nsArgs: unknown[]) => {
            queue.push(nsArgs);
          }) as CalFn;
          api.q = queue;
          api.ns = current.ns;
          current.ns[namespace] = api;
        }
        const namespaced = current.ns[namespace];
        if (namespaced) push(namespaced, args);
        push(current, ["initNamespace", namespace]);
        return;
      }
      push(current, args);
      return;
    }

    push(current, args);
  } as CalFn;

  cal.ns = {};
  cal.q = [];
  root.Cal = cal;
  return cal;
}
