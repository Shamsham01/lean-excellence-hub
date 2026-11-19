"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { THREAD_STEPS } from "./content";
import { ProductWindow } from "./product-window";
import { ThemedCapture } from "./themed-capture";

/**
 * Observe → Learn (art direction §6.3). ≥1024: a thread rail of tabs above
 * one fixed 16:10 window that crossfades. <1024: the same five steps as a
 * vertical list; a step shows a capture only where a narrow crop keeps its
 * UI text ≥10 px, so nothing is shrunk, upscaled or cut off.
 */
export function ThreadCarousel() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
      style={{
        ["--active" as string]: active,
        ["--steps" as string]: count,
      }}
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
            <span className="v6-rail-head">
              <span className="v6-kicker">{step.index}</span>
              <span className="v6-rail-title">{step.title}</span>
            </span>
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
                {/* ATELIER r3: every slide is 16:10. A wider capture is
                    top-aligned and fades into the screen colour. */}
                <div className="v6-frame-shot">
                  <ThemedCapture
                    slot={step.desktop}
                    sizes="(min-width: 1360px) 1200px, 92vw"
                  />
                  {step.desktop.width / step.desktop.height > 1.61 ? (
                    <span className="v6-frame-fade" aria-hidden="true" />
                  ) : null}
                </div>
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

      {/* Below 1024 px */}
      <ol className="v6-steps" role="list">
        {THREAD_STEPS.map((step) => (
          <li key={step.id} className="v6-step">
            <p className="v6-kicker" data-thread="node">
              {step.index} · {step.module}
            </p>
            <h3 className="v6-h3">{step.title}</h3>
            <p className="v6-small">{step.line}</p>
            {step.mobile ? (
              <ProductWindow
                slot={step.mobile}
                sizes="(min-width: 640px) 420px, 100vw"
                className="v6-step-window"
                // Natural aspect, never wider than its 2x phone capture.
                style={{ maxWidth: `${step.mobile.width / 2}px` }}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
