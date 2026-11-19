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
import { ProductWindow } from "./product-window";
import { ThemedCapture } from "./themed-capture";

/**
 * Observe → Learn carousel (art direction §6.3). ≥1024: a thread rail of
 * tabs above one fixed 16:10 window that crossfades. <1024: a chip row and a
 * swipeable scroll-snap track with one full-width slide at a time.
 */
export function ThreadCarousel() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const fromScroll = useRef(false);
  const count = THREAD_STEPS.length;

  const go = useCallback(
    (index: number, focus = false) => {
      const next = (index + count) % count;
      setActive(next);
      if (focus) {
        tabRefs.current[next]?.focus();
      }
    },
    [count],
  );

  // Keep the mobile track and chip row in step with the active slide.
  useEffect(() => {
    const track = trackRef.current;
    if (track && !fromScroll.current && track.offsetParent !== null) {
      const slide = track.children[active] as HTMLElement | undefined;
      if (slide) {
        track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
      }
    }
    fromScroll.current = false;
    const chip = chipRefs.current[active];
    const row = chip?.parentElement;
    if (chip && row && row.offsetParent !== null) {
      row.scrollTo({
        left: chip.offsetLeft - 20,
        behavior: "smooth",
      });
    }
  }, [active]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const index = Math.round(track.scrollLeft / (track.clientWidth + 16));
        if (index >= 0 && index < count) {
          fromScroll.current = true;
          setActive(index);
        }
      }, 90);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [count]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(active + 1, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(active - 1, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      go(count - 1, true);
    }
  };

  return (
    <div
      className="v6-carousel"
      style={{ ["--active" as string]: active, ["--steps" as string]: count }}
    >
      <div className="v6-rail" role="tablist" aria-label="From one finding">
        <span className="v6-rail-line" aria-hidden="true" data-thread="stub" />
        <span className="v6-rail-fill" aria-hidden="true" />
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
            aria-controls="v6-thread-panel"
            tabIndex={index === active ? 0 : -1}
            className={cn("v6-rail-tab", index < active && "is-done")}
            onClick={() => go(index)}
            onKeyDown={onKeyDown}
          >
            <span className="v6-rail-node" aria-hidden="true" />
            <span className="v6-kicker">{step.index}</span>
            <span className="v6-rail-title">{step.title}</span>
            <span className="v6-rail-module">{step.module}</span>
          </button>
        ))}
      </div>

      <div
        id="v6-thread-panel"
        role="tabpanel"
        aria-labelledby={`v6-tab-${THREAD_STEPS[active]?.id ?? "observe"}`}
        className="v6-carousel-stage"
      >
        <ProductWindow className="v6-carousel-window">
          <div className="v6-carousel-frames">
            {THREAD_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "v6-carousel-frame",
                  index === active && "is-active",
                )}
                aria-hidden={index !== active}
              >
                <ThemedCapture
                  slot={step.desktop}
                  sizes="(min-width: 1360px) 1200px, 92vw"
                />
              </div>
            ))}
          </div>
        </ProductWindow>
        <div className="v6-carousel-nav">
          <button
            type="button"
            className="v6-round-button"
            aria-label="Previous step"
            onClick={() => go(active - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className="v6-round-button"
            aria-label="Next step"
            onClick={() => go(active + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* Below 1024 px: 4:5 focus crops keep UI text ≥10 px */}
      <div className="v6-chips" aria-label="Steps" role="group">
        {THREAD_STEPS.map((step, index) => (
          <button
            key={step.id}
            ref={(el) => {
              chipRefs.current[index] = el;
            }}
            type="button"
            className={cn("v6-chip", index === active && "is-active")}
            aria-pressed={index === active}
            onClick={() => go(index)}
          >
            <span className="v6-kicker">{step.index}</span> {step.title}
          </button>
        ))}
      </div>
      <div className="v6-track" ref={trackRef}>
        {THREAD_STEPS.map((step) => (
          <div key={step.id} className="v6-track-slide">
            <ProductWindow slot={step.mobile} sizes="100vw" />
          </div>
        ))}
      </div>
    </div>
  );
}
