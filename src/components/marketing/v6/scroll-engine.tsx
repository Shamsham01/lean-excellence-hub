"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * One scroll source for the v6 page.
 *
 * ≥1024 px with a fine pointer and no reduced-motion preference: Lenis
 * smooths wheel input and, once a wheel / trackpad gesture ends, a gentle
 * direction-aware snap carries the page to the next section top or pin step.
 * Sections taller than the viewport read freely and only snap near their
 * edges. Touch, coarse pointers and reduced motion keep
 * native scrolling with no snap at all.
 *
 * Scroll-linked effects read `getScrollY()` so they follow the same value
 * Lenis writes, with no jitter between the two.
 */

let lenis: Lenis | null = null;

export function getScrollY(): number {
  return lenis ? lenis.scroll : window.scrollY;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Scroll the page to `y`, smoothly unless the user prefers reduced motion. */
export function scrollToY(y: number) {
  const top = Math.max(0, Math.round(y));
  if (lenis) {
    lenis.scrollTo(top, { duration: 0.8, easing: easeOutCubic });
    return;
  }
  window.scrollTo({
    top,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/** Document-space top of an element (layout read: call on resize, not per frame). */
export function docTop(el: Element): number {
  return el.getBoundingClientRect().top + getScrollY();
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const SMOOTH_MEDIA =
  "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Snap tuning (ATELIER snap fix, 19 Nov 2026).
 *
 * A wheel / trackpad gesture is over once no wheel event has arrived for
 * IDLE_MS (trackpad momentum included). The snap then reads where Lenis is
 * heading (its target, not the lerp tail) and eases to the next stop in the
 * gesture's direction: the "little pause", then a gentle settle.
 */
const IDLE_MS = 260;
/** Movements under this many px are a nudge: return to the stop just left. */
const NUDGE_PX = 30;
/** Gaps up to this × viewport are one "screen": any deliberate gesture carries across. */
const SHORT_GAP = 1.15;
/** Gaps over this × viewport get an extra stop where the section's end meets the viewport bottom. */
const TALL_GAP = 1.3;
/** In a tall section, snap forward only when the target is this close to the next stop. */
const EDGE = 0.3;
/** Overshooting a stop by at most this much eases back onto it. */
const OVERSHOOT = 0.2;
const MIN_SECONDS = 0.5;
const MAX_SECONDS = 0.75;

type Stop = { y: number; margin: number };

/** Every resting point, sorted: section tops, pin steps, tall-section ends and the page end. */
export function collectStops(root: HTMLElement, vh: number, max: number) {
  const raw: Stop[] = [
    { y: 0, margin: 0 },
    { y: max, margin: 0 },
  ];
  root.querySelectorAll<HTMLElement>("[data-snap]").forEach((el) => {
    if (el.offsetParent === null && el !== document.body) {
      return;
    }
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    raw.push({ y: docTop(el) - margin, margin });
  });
  root.querySelectorAll<HTMLElement>("[data-pin-track]").forEach((track) => {
    const start = docTop(track);
    const end = start + track.offsetHeight - vh;
    if (end - start < 8) {
      return;
    }
    raw.push({ y: start, margin: 0 }, { y: end, margin: 0 });
    const steps = Number(track.dataset.pinSteps ?? 0);
    for (let k = 1; k < steps - 1; k += 1) {
      raw.push({ y: start + ((end - start) * k) / (steps - 1), margin: 0 });
    }
  });
  return withTallEnds(dedupe(raw, max), vh);
}

function dedupe(raw: Stop[], max: number): Stop[] {
  const sorted = raw
    .map((s) => ({
      y: Math.min(max, Math.max(0, Math.round(s.y))),
      margin: s.margin,
    }))
    .sort((a, b) => a.y - b.y);
  const out: Stop[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.y - last.y < 6) {
      last.margin = Math.max(last.margin, s.margin);
    } else {
      out.push(s);
    }
  }
  return out;
}

/** A section taller than the viewport reads freely; it gets one extra stop at its end. */
export function withTallEnds(stops: Stop[], vh: number): Stop[] {
  const out: Stop[] = [];
  stops.forEach((s, i) => {
    const next = stops[i + 1];
    out.push(s);
    if (next && next.y - s.y > TALL_GAP * vh) {
      out.push({ y: Math.round(next.y + next.margin - vh), margin: 0 });
    }
  });
  return out;
}

/**
 * Where a finished gesture should rest. `from` is where the gesture began,
 * `to` where Lenis is heading. Returns null to leave the page where it is.
 */
export function pickStop(
  ys: number[],
  from: number,
  to: number,
  vh: number,
): number | null {
  if (ys.length === 0) {
    return null;
  }
  const moved = to - from;
  if (Math.abs(moved) < NUDGE_PX) {
    // A nudge off a stop goes back to it; anywhere else it stays.
    const home = ys.find((y) => Math.abs(y - from) <= 3);
    return home !== undefined && Math.abs(home - to) >= 2 ? home : null;
  }
  const down = moved > 0;
  // `behind`: the last stop at or before the target in the gesture's direction;
  // `ahead`: the first stop past it.
  let behind: number | undefined;
  let ahead: number | undefined;
  if (down) {
    for (const y of ys) {
      if (y <= to) behind = y;
      else if (ahead === undefined) ahead = y;
    }
  } else {
    for (const y of [...ys].reverse()) {
      if (y >= to) behind = y;
      else if (ahead === undefined) ahead = y;
    }
  }
  const crossed =
    behind !== undefined && (down ? behind > from + 2 : behind < from - 2);
  if (
    behind !== undefined &&
    crossed &&
    Math.abs(to - behind) <= OVERSHOOT * vh
  ) {
    return behind;
  }
  if (ahead === undefined) {
    return behind !== undefined && Math.abs(to - behind) >= 2 ? behind : null;
  }
  if (behind === undefined) {
    return ahead;
  }
  const gap = Math.abs(ahead - behind);
  if (gap <= SHORT_GAP * vh || Math.abs(ahead - to) <= EDGE * vh) {
    return ahead;
  }
  // Mid-way through a tall section: free reading, no snap.
  return null;
}

/** Ease that keeps the gesture's momentum when continuing, and turns gently when reversing. */
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SmoothScroll({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(SMOOTH_MEDIA);
    let frame = 0;
    let idle = 0;
    /** Scroll position when the current wheel gesture began; null when idle. */
    let gestureFrom: number | null = null;

    const settle = () => {
      idle = 0;
      const from = gestureFrom;
      gestureFrom = null;
      if (!lenis || from === null) {
        return;
      }
      const vh = window.innerHeight;
      const to = lenis.targetScroll;
      const stops = collectStops(root, vh, lenis.limit);
      const target = pickStop(
        stops.map((s) => s.y),
        from,
        to,
        vh,
      );
      if (target === null || Math.abs(target - to) < 2) {
        return;
      }
      const now = lenis.scroll;
      const distance = Math.abs(target - now);
      const reversing = Math.sign(target - now) !== Math.sign(to - from);
      const seconds = Math.min(
        MAX_SECONDS,
        Math.max(MIN_SECONDS, 0.4 + (distance / vh) * 0.35),
      );
      lenis.scrollTo(target, {
        duration: seconds,
        easing: reversing ? easeInOutCubic : easeOutQuart,
      });
    };

    const onWheel = (event: WheelEvent) => {
      if (!lenis || event.ctrlKey) {
        return;
      }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-lenis-prevent]") !== null
      ) {
        return;
      }
      if (gestureFrom === null) {
        gestureFrom = lenis.scroll;
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
    };

    // Clicks (anchors, the rail) and keys land exactly where they were sent.
    const onPointer = () => {
      gestureFrom = null;
      window.clearTimeout(idle);
    };

    const raf = (time: number) => {
      lenis?.raf(time);
      frame = requestAnimationFrame(raf);
    };

    const start = () => {
      if (lenis) {
        return;
      }
      lenis = new Lenis({
        lerp: 0.12,
        smoothWheel: true,
        syncTouch: false,
        stopInertiaOnNavigate: true,
        prevent: (node) => node.closest?.("[data-lenis-prevent]") !== null,
      });
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });
      window.addEventListener("keydown", onPointer, { passive: true });
      frame = requestAnimationFrame(raf);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idle);
      gestureFrom = null;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onPointer);
      lenis?.destroy();
      lenis = null;
    };
    const sync = () => (media.matches ? start() : stop());

    sync();
    media.addEventListener?.("change", sync);
    return () => {
      media.removeEventListener?.("change", sync);
      stop();
    };
  }, [rootId]);

  return null;
}
