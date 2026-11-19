"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

import { THREAD_STEPS } from "./content";
import {
  docTop,
  getScrollY,
  prefersReducedMotion,
  scrollToY,
} from "./scroll-engine";
import { ThemedCapture } from "./themed-capture";

type Mode = "tabs" | "pin" | "swipe";

const PIN_MEDIA =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
const WIDE_MEDIA = "(min-width: 1024px)";
/** Share of each step-to-step segment spent resting on a step. */
const REST = 0.2;

/** Scroll progress → panel position, resting on each step for a moment. */
export function restingPosition(progress: number, count: number): number {
  const u = Math.min(1, Math.max(0, progress)) * (count - 1);
  const k = Math.min(count - 2, Math.floor(u));
  const t = u - k;
  const m = Math.min(1, Math.max(0, (t - REST) / (1 - 2 * REST)));
  const eased = m * m * (3 - 2 * m);
  return k + eased;
}

/**
 * Observe → Learn (art direction §6.3).
 * ≥1024: the section is pinned and vertical scroll moves a horizontal track
 * of the five steps; the rail shows progress and jumps to a step.
 * <1024: a native swipe track with the rail in sync.
 * Reduced motion ≥1024: the tabbed 16:10 carousel.
 */
export function ThreadCarousel() {
  const count = THREAD_STEPS.length;
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>("tabs");
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const geo = useRef({ start: 0, span: 1, stride: 1 });
  const activeRef = useRef(0);

  // Mode from media queries.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const pin = window.matchMedia(PIN_MEDIA);
    const wide = window.matchMedia(WIDE_MEDIA);
    const sync = () =>
      setMode(pin.matches ? "pin" : wide.matches ? "tabs" : "swipe");
    sync();
    pin.addEventListener?.("change", sync);
    wide.addEventListener?.("change", sync);
    return () => {
      pin.removeEventListener?.("change", sync);
      wide.removeEventListener?.("change", sync);
    };
  }, []);

  const setActiveIndex = useCallback((i: number) => {
    if (activeRef.current !== i) {
      activeRef.current = i;
      setActive(i);
    }
  }, []);

  // Scroll-driven position (pin) or swipe-driven position (swipe).
  useEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!root || !viewport || !track) {
      return;
    }
    const pinTrack = root.closest<HTMLElement>("[data-pin-track]");
    const panels = panelRefs.current;
    let frame = 0;

    const paint = (pos: number) => {
      const fill = fillRef.current;
      if (fill) {
        fill.style.transform = `scaleX(${pos / (count - 1)})`;
      }
      if (mode === "pin") {
        track.style.transform = `translate3d(${-pos * geo.current.stride}px,0,0)`;
        panels.forEach((panel, k) => {
          if (panel) {
            panel.style.opacity = String(
              1 - Math.min(1, Math.abs(pos - k)) * 0.65,
            );
          }
        });
      }
      setActiveIndex(Math.round(pos));
    };

    const update = () => {
      frame = 0;
      if (mode === "pin") {
        const { start, span } = geo.current;
        paint(restingPosition((getScrollY() - start) / span, count));
      } else if (mode === "swipe") {
        paint(
          Math.min(
            count - 1,
            Math.max(0, viewport.scrollLeft / geo.current.stride),
          ),
        );
      }
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };

    const measure = () => {
      const first = panels[0];
      const second = panels[1];
      if (first && second) {
        geo.current.stride = Math.max(1, second.offsetLeft - first.offsetLeft);
      }
      if (pinTrack && mode === "pin") {
        geo.current.start = docTop(pinTrack);
        geo.current.span = Math.max(
          1,
          pinTrack.offsetHeight - window.innerHeight,
        );
      }
      schedule();
    };

    if (mode === "tabs") {
      track.style.transform = "";
      panels.forEach((p) => p && (p.style.opacity = ""));
      const fill = fillRef.current;
      if (fill) {
        fill.style.transform = "";
      }
      return;
    }

    measure();
    const target: Window | HTMLElement = mode === "pin" ? window : viewport;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      track.style.transform = "";
      panels.forEach((p) => p && (p.style.opacity = ""));
    };
  }, [mode, count, setActiveIndex]);

  const go = useCallback(
    (index: number, focus = false) => {
      const next = Math.min(count - 1, Math.max(0, index));
      if (focus) {
        tabRefs.current[next]?.focus({ preventScroll: true });
      }
      if (mode === "pin") {
        const { start, span } = geo.current;
        scrollToY(start + (span * next) / (count - 1));
      } else if (mode === "swipe") {
        viewportRef.current?.scrollTo({
          left: next * geo.current.stride,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      } else {
        setActiveIndex(next);
      }
    },
    [count, mode, setActiveIndex],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };
    const next = keys[event.key];
    if (next !== undefined) {
      event.preventDefault();
      go(mode === "tabs" ? (next + count) % count : next, true);
    }
  };

  return (
    <div
      ref={rootRef}
      className="v6-carousel"
      data-mode={mode}
      style={{
        ["--active" as string]: active,
        ["--steps" as string]: count,
      }}
    >
      <div className="v6-rail" role="tablist" aria-label="From one finding">
        <span className="v6-rail-line" aria-hidden="true" data-thread="stub" />
        <span className="v6-rail-fill" aria-hidden="true" ref={fillRef} />
        {THREAD_STEPS.map((step, index) => (
          <button
            key={step.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`v6-tab-${step.id}`}
            aria-selected={index === active}
            aria-controls={`v6-panel-${step.id}`}
            tabIndex={index === active ? 0 : -1}
            className={cn("v6-rail-tab", index < active && "is-done")}
            onClick={() => go(index)}
            onKeyDown={onKeyDown}
          >
            <span className="v6-rail-node" aria-hidden="true" />
            <span className="v6-rail-head">
              <span className="v6-kicker">{step.index}</span>
              <span className="v6-rail-title">{step.title}</span>
            </span>
            <span className="v6-rail-module">{step.module}</span>
          </button>
        ))}
      </div>

      <div className="v6-hviewport" ref={viewportRef}>
        <div className="v6-htrack" ref={trackRef}>
          {THREAD_STEPS.map((step, index) => (
            <div
              key={step.id}
              ref={(el) => {
                panelRefs.current[index] = el;
              }}
              id={`v6-panel-${step.id}`}
              role="tabpanel"
              aria-labelledby={`v6-tab-${step.id}`}
              className={cn("v6-hpanel", index === active && "is-active")}
            >
              {/* ≥1024: the desktop capture in the coded window. */}
              <figure className="v6-window v6-hpanel-desk">
                <div className="v6-window-chrome" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div
                  className="v6-window-body v6-hpanel-body"
                  data-wide={
                    step.desktop &&
                    step.desktop.width / step.desktop.height > 1.61
                      ? "true"
                      : undefined
                  }
                >
                  {step.desktop ? (
                    <div className="v6-frame-shot">
                      <ThemedCapture
                        slot={step.desktop}
                        sizes="(min-width: 1360px) 1200px, 92vw"
                      />
                    </div>
                  ) : step.mobile ? (
                    <div
                      className="v6-frame-shot is-phone"
                      style={{ width: `${step.mobile.width / 2}px` }}
                    >
                      <ThemedCapture slot={step.mobile} sizes="390px" />
                    </div>
                  ) : null}
                  <span className="v6-frame-fade" aria-hidden="true" />
                </div>
              </figure>

              {/* <1024: the step's copy and its phone capture. */}
              <div className="v6-step v6-hpanel-swipe">
                <p className="v6-kicker">
                  {step.index} · {step.module}
                </p>
                <h3 className="v6-h3">{step.title}</h3>
                <p className="v6-small">{step.line}</p>
                {step.mobile ? (
                  <figure
                    className="v6-window v6-step-window"
                    style={{ maxWidth: `${step.mobile.width / 2}px` }}
                  >
                    <div className="v6-window-chrome" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="v6-window-body">
                      <ThemedCapture
                        slot={step.mobile}
                        sizes="(min-width: 640px) 420px, 100vw"
                      />
                    </div>
                  </figure>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v6-carousel-nav">
        <button
          type="button"
          className="v6-round-button"
          aria-label="Previous step"
          onClick={() => go((active - 1 + count) % count)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className="v6-round-button"
          aria-label="Next step"
          onClick={() => go((active + 1) % count)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
