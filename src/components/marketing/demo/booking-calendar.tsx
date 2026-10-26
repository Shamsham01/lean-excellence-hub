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

/** How long to wait before treating a silent embed script as failed. */
export const DEMO_EMBED_LOAD_TIMEOUT_MS = 15_000;

const EMBED_STATUS_ATTRIBUTE = "data-leh-embed-status";

/**
 * Official Cal.com inline embed.
 *
 * Each mount issues `inline` for the element that is on the page now.
 * A previous visit must not suppress that call: the embed node from the
 * last visit is gone after a client-side navigation. React Strict Mode
 * can also queue two `inline` commands before the script runs, so this
 * component keeps only the latest frame.
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

    let alive = true;
    setPhase("loading");

    const cal = installCalEmbed(booking.embedScriptUrl);
    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setPhase((current) => {
        if (current !== "loading") return current;
        return element.querySelector("iframe") ? "ready" : "failed";
      });
    }, DEMO_EMBED_LOAD_TIMEOUT_MS);

    const onScriptError = () => {
      if (!alive) return;
      window.clearTimeout(timeout);
      setPhase("failed");
    };

    cal("init", DEMO_EMBED_NAMESPACE, { origin: booking.origin });
    const api = cal.ns[DEMO_EMBED_NAMESPACE];
    api?.("inline", {
      elementOrSelector: element,
      calLink: booking.calLink,
      config: demoEmbedConfig(theme),
    });
    api?.("on", {
      action: "linkFailed",
      callback: () => {
        if (alive) setPhase("failed");
      },
    });
    api?.("on", {
      action: "linkReady",
      callback: () => {
        if (alive) setPhase("ready");
      },
    });
    api?.("ui", demoEmbedUi(theme));

    // The script tag is inserted on the first queued call, so listen after it.
    const script = embedScriptElement(booking.embedScriptUrl);
    script?.addEventListener("error", onScriptError);

    const prune = () => keepLatestFrame(element);
    const frameObserver = new MutationObserver(prune);
    frameObserver.observe(element, { childList: true, subtree: true });
    prune();

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      script?.removeEventListener("error", onScriptError);
      frameObserver.disconnect();
      element.replaceChildren();
    };
  }, [booking.calLink, booking.embedScriptUrl, booking.origin, theme]);

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

function embedScriptElement(embedJsUrl: string) {
  return document.querySelector<HTMLScriptElement>(
    `script[src="${embedJsUrl}"]`,
  );
}

function keepLatestFrame(element: HTMLElement) {
  const frames = element.querySelectorAll("iframe");
  if (frames.length < 2) return;
  const latest = frames[frames.length - 1];
  if (!latest) return;
  for (const child of [...element.children]) {
    if (child !== latest && !child.contains(latest)) child.remove();
  }
}

function installCalEmbed(embedJsUrl: string): CalFn {
  const root = window as Window & { Cal?: CalFn };
  for (const script of document.querySelectorAll<HTMLScriptElement>(
    `script[src="${embedJsUrl}"]`,
  )) {
    if (script.getAttribute(EMBED_STATUS_ATTRIBUTE) === "error") {
      script.remove();
      delete root.Cal;
    }
  }

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
      script.setAttribute("referrerpolicy", "no-referrer");
      script.addEventListener("error", () => {
        script.setAttribute(EMBED_STATUS_ATTRIBUTE, "error");
        if (root.Cal === current) delete root.Cal;
      });
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
