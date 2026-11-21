"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { docTop, getScrollY, prefersReducedMotion } from "./scroll-engine";

/** 75 frames per theme: every 2nd frame of the 6 s clip, up to 8 frames after
 *  the rotation ends (ATELIER scroll-story brief §1). */
export const SCRUB_FRAMES = 75;
export const SCRUB_SIZE = { width: 632, height: 1280 } as const;
const BASE = "/marketing/v6/scrub";
/** The phone turns over the first 70% of the pin, then rests. */
const TURN_SHARE = 0.7;

type Theme = "light" | "dark";
type Mode = "pin" | "pass" | "static";

const frameSrc = (theme: Theme, index: number) =>
  `${BASE}/${theme}/${String(index).padStart(3, "0")}.webp`;

/** Coarse-to-fine load order: a usable scrub after ~10 requests. */
function loadOrder(count: number): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const step of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
    if (!seen.has(count - 1)) {
      seen.add(count - 1);
      order.push(count - 1);
    }
  }
  return order;
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The Action Card visual: the phone turns from its back to the action
 * ACT-2026-0020 as the page scrolls. ≥768 the stage is pinned for one extra
 * screen; <768 the phone scrubs while it passes through the viewport.
 * Reduced motion shows the final pose only.
 */
export function ActionScrub({
  copy,
  label,
}: {
  copy: ReactNode;
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const phone = phoneRef.current;
    const canvas = canvasRef.current;
    if (
      !track ||
      !phone ||
      !canvas ||
      typeof window.matchMedia !== "function" ||
      typeof IntersectionObserver !== "function" ||
      prefersReducedMotion()
    ) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const frames: Record<Theme, (HTMLImageElement | null)[]> = {
      light: new Array(SCRUB_FRAMES).fill(null),
      dark: new Array(SCRUB_FRAMES).fill(null),
    };
    const started: Record<Theme, boolean> = { light: false, dark: false };
    let theme: Theme = currentTheme();
    let mode: Mode = "pin";
    let frame = 0;
    let target = 0;
    let drawn = "";
    let ready = false;
    // Cached geometry (layout reads happen in measure() only).
    let start = 0;
    let span = 1;

    const pinMedia = window.matchMedia("(min-width: 768px)");

    const measure = () => {
      const vh = window.innerHeight;
      mode = pinMedia.matches ? "pin" : "pass";
      if (mode === "pin") {
        start = docTop(track);
        span = Math.max(1, track.offsetHeight - vh);
      } else {
        // From the phone's top entering the lower edge of the viewport to
        // its whole body sitting in view.
        const top = docTop(phone);
        const height = phone.offsetHeight;
        start = top - vh * 0.95;
        span = Math.max(1, top + height - vh * 0.92 - start);
      }
      const rect = phone.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Never upscale beyond the exported frames.
      const w = Math.min(SCRUB_SIZE.width, Math.round(rect.width * dpr));
      const h = Math.round((w * SCRUB_SIZE.height) / SCRUB_SIZE.width);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawn = "";
      }
      schedule();
    };

    const progress = () => {
      const p = Math.min(1, Math.max(0, (getScrollY() - start) / span));
      const turn = mode === "pin" ? Math.min(1, p / TURN_SHARE) : p;
      return turn;
    };

    const nearestLoaded = (list: (HTMLImageElement | null)[], i: number) => {
      for (let d = 0; d < SCRUB_FRAMES; d += 1) {
        const a = list[i - d];
        if (a) {
          return a;
        }
        const b = list[i + d];
        if (b) {
          return b;
        }
      }
      return null;
    };

    const draw = () => {
      frame = 0;
      target = Math.round(progress() * (SCRUB_FRAMES - 1));
      const other: Theme = theme === "dark" ? "light" : "dark";
      // On a theme toggle, keep the old theme's frame until the new one has
      // arrived: same matte and pose, so nothing flashes.
      const img =
        nearestLoaded(frames[theme], target) ??
        nearestLoaded(frames[other], target);
      if (!img) {
        return;
      }
      const key = `${img.src}|${canvas.width}`;
      if (key === drawn) {
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawn = key;
      if (!ready) {
        ready = true;
        phone.dataset.ready = "true";
      }
    };

    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(draw);
      }
    }

    const load = (which: Theme) => {
      if (started[which]) {
        return;
      }
      started[which] = true;
      // Frames near the current position first, then coarse-to-fine.
      const here = target;
      const order = [
        here,
        ...loadOrder(SCRUB_FRAMES).filter((i) => i !== here),
      ];
      let next = 0;
      const pump = () => {
        const i = order[next];
        next += 1;
        if (i === undefined) {
          return;
        }
        const img = new Image();
        img.decoding = "async";
        (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
          "low";
        img.src = frameSrc(which, i);
        const done = () => {
          frames[which][i] = img;
          schedule();
          pump();
        };
        img
          .decode()
          .then(done)
          .catch(() => pump());
      };
      // Four parallel lanes keep the connection busy without flooding it.
      for (let lane = 0; lane < 4; lane += 1) {
        pump();
      }
    };

    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load(theme);
          near.disconnect();
        }
      },
      { rootMargin: "150% 0px 150% 0px" },
    );
    near.observe(track);

    const themeObserver = new MutationObserver(() => {
      const next = currentTheme();
      if (next !== theme) {
        theme = next;
        if (started.light || started.dark) {
          load(theme);
        }
        drawn = "";
        schedule();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onScroll = () => schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    pinMedia.addEventListener?.("change", measure);
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      near.disconnect();
      themeObserver.disconnect();
      ro?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      pinMedia.removeEventListener?.("change", measure);
    };
  }, []);

  return (
    <div className="v6-scrub-track" data-pin-track ref={trackRef}>
      <div className="v6-scrub-stage" data-pin-stage>
        <div className="v6-container v6-action-grid">
          {copy}
          <div className="v6-action-visual v6-scrub-visual">
            <div className="v6-stage-glow" aria-hidden="true" />
            <div
              className="v6-scrub-phone"
              ref={phoneRef}
              role="img"
              aria-label={label}
            >
              <span className="v6-scrub-shadow" aria-hidden="true" />
              {(["light", "dark"] as const).map((t) => (
                <img
                  key={`first-${t}`}
                  src={`${BASE}/first-${t}.webp`}
                  alt=""
                  width={SCRUB_SIZE.width}
                  height={SCRUB_SIZE.height}
                  className={`v6-scrub-still is-first cap-${t}`}
                  decoding="async"
                  loading="lazy"
                />
              ))}
              {(["light", "dark"] as const).map((t) => (
                <img
                  key={`poster-${t}`}
                  src={`${BASE}/poster-${t}.webp`}
                  alt=""
                  width={SCRUB_SIZE.width}
                  height={SCRUB_SIZE.height}
                  className={`v6-scrub-still is-poster cap-${t}`}
                  decoding="async"
                  loading="lazy"
                />
              ))}
              <canvas
                ref={canvasRef}
                className="v6-scrub-canvas"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
