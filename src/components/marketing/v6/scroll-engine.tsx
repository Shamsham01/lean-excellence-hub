"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * One scroll source for the v6 page.
 *
 * ≥1024 px with a fine pointer and no reduced-motion preference: Lenis
 * smooths wheel input and a gentle, proximity-only snap settles on section
 * tops after the wheel stops. Touch, coarse pointers and reduced motion keep
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

/** Settle delay after the last scroll movement (the "little pause"). */
const SETTLE_MS = 120;
/** Outside a pinned range: snap only when a point is within 22% of the viewport. */
const RADIUS = 0.22;
/** Inside a pinned range: only its own points, and only when very close. */
const PIN_RADIUS = 0.1;
const SNAP_SECONDS = 0.45;

type Point = { y: number; radius: number };
type Pin = { start: number; end: number; points: Point[] };

function collect(root: HTMLElement, vh: number) {
  const points: Point[] = [];
  const pins: Pin[] = [];
  root.querySelectorAll<HTMLElement>("[data-snap]").forEach((el) => {
    if (el.offsetParent === null && el !== document.body) {
      return;
    }
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    points.push({ y: docTop(el) - margin, radius: RADIUS * vh });
  });
  root.querySelectorAll<HTMLElement>("[data-pin-track]").forEach((track) => {
    const start = docTop(track);
    const end = start + track.offsetHeight - vh;
    if (end - start < 8) {
      return;
    }
    const own: Point[] = [
      { y: start, radius: PIN_RADIUS * vh },
      { y: end, radius: PIN_RADIUS * vh },
    ];
    const steps = Number(track.dataset.pinSteps ?? 0);
    for (let k = 0; k < steps; k += 1) {
      own.push({
        y: start + ((end - start) * k) / Math.max(1, steps - 1),
        radius: PIN_RADIUS * vh,
      });
    }
    pins.push({ start, end, points: own });
    // From outside, the pin start is an ordinary section snap point.
    points.push({ y: start, radius: RADIUS * vh });
    points.push({ y: end, radius: PIN_RADIUS * vh });
  });
  return { points, pins };
}

export function SmoothScroll({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(SMOOTH_MEDIA);
    let frame = 0;
    let settle = 0;
    let lastWheel = 0;
    let snapping = false;
    let geometry: ReturnType<typeof collect> = { points: [], pins: [] };
    let dirty = true;

    const markDirty = () => {
      dirty = true;
    };

    const trySnap = () => {
      if (!lenis || snapping) {
        return;
      }
      // Only after wheel / trackpad input: anchors, keyboard and clicks land
      // exactly where they were sent.
      if (performance.now() - lastWheel > 1500) {
        return;
      }
      const vh = window.innerHeight;
      if (dirty) {
        geometry = collect(root, vh);
        dirty = false;
      }
      const y = lenis.scroll;
      const inside = geometry.pins.find(
        (p) => y > p.start + 1 && y < p.end - 1,
      );
      const candidates = inside ? inside.points : geometry.points;
      let best: Point | null = null;
      let bestD = Infinity;
      for (const p of candidates) {
        const d = Math.abs(p.y - y);
        if (d <= p.radius && d < bestD) {
          best = p;
          bestD = d;
        }
      }
      if (!best || bestD < 2) {
        return;
      }
      snapping = true;
      lenis.scrollTo(best.y, {
        duration: SNAP_SECONDS,
        easing: easeOutCubic,
        onComplete: () => {
          snapping = false;
        },
      });
      // A wheel during the ease cancels it (Lenis retargets); never stay locked.
      window.setTimeout(
        () => {
          snapping = false;
        },
        SNAP_SECONDS * 1000 + 80,
      );
    };

    let settling = false;
    const onScroll = () => {
      if (snapping) {
        return;
      }
      // Lenis' lerp tail keeps emitting sub-pixel scrolls for ~1 s; the page
      // counts as settled once it is barely moving, and the tail must not
      // keep pushing the pause back.
      const slow = lenis ? Math.abs(lenis.velocity) < 1.5 : true;
      if (slow && settling) {
        return;
      }
      window.clearTimeout(settle);
      settling = slow;
      settle = window.setTimeout(
        () => {
          settling = false;
          trySnap();
        },
        slow ? SETTLE_MS : SETTLE_MS * 3,
      );
    };
    const onWheel = () => {
      lastWheel = performance.now();
      snapping = false;
      settling = false;
      window.clearTimeout(settle);
    };

    // Clicks (anchors, the rail) and keys land exactly where they were sent.
    const onPointer = () => {
      lastWheel = 0;
      settling = false;
      window.clearTimeout(settle);
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
      lenis.on("scroll", onScroll);
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });
      window.addEventListener("keydown", onPointer, { passive: true });
      frame = requestAnimationFrame(raf);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onPointer);
      lenis?.destroy();
      lenis = null;
    };
    const sync = () => (media.matches ? start() : stop());

    sync();
    media.addEventListener?.("change", sync);
    const ro =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(markDirty)
        : null;
    ro?.observe(root);
    window.addEventListener("resize", markDirty);
    return () => {
      media.removeEventListener?.("change", sync);
      ro?.disconnect();
      window.removeEventListener("resize", markDirty);
      stop();
    };
  }, [rootId]);

  return null;
}
