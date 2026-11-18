"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CarouselStep = {
  id: string;
  index: string;
  title: string;
  module: string;
  summary: string;
};

/** Left scroll padding: where a snapped slide starts inside the track. */
function inset(element: HTMLElement) {
  return parseFloat(getComputedStyle(element).scrollPaddingLeft) || 0;
}

/**
 * The finding story as a horizontal scroll-snap carousel. The step buttons
 * scroll to their capture; swiping, the trackpad, arrow keys on the focused
 * track or the arrow buttons move between slides. Captures are never cropped.
 */
export function LineageCarousel({
  label,
  steps,
  children,
}: {
  label: string;
  steps: readonly CarouselStep[];
  children: ReactNode;
}) {
  const trackId = useId();
  const track = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const slides = useCallback(
    () =>
      Array.from(track.current?.children ?? []).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      ),
    [],
  );

  const update = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setAtStart(element.scrollLeft <= 2);
    setAtEnd(element.scrollLeft >= max - 2);
    const origin = element.getBoundingClientRect().left + inset(element);
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    slides().forEach((slide, index) => {
      const distance = Math.abs(slide.getBoundingClientRect().left - origin);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    if (max > 0 && element.scrollLeft >= max - 2) {
      nearest = slides().length - 1;
    }
    setActive(nearest);
  }, [slides]);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function goTo(index: number) {
    const element = track.current;
    const slide = slides()[index];
    if (!element || !slide) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      left:
        slide.getBoundingClientRect().left -
        element.getBoundingClientRect().left -
        inset(element) +
        element.scrollLeft,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <div
      className="editorial-story editorial-story-shell editorial-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <ol className="editorial-lineage">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              className="editorial-step"
              aria-pressed={active === index}
              aria-controls={trackId}
              onClick={() => goTo(index)}
            >
              <span className="editorial-step-index" aria-hidden="true">
                {step.index}
              </span>
              <h3 id={`finding-step-${step.id}`}>{step.title}</h3>
              <p className="editorial-step-module">{step.module}</p>
              <p className="editorial-step-summary">{step.summary}</p>
            </button>
          </li>
        ))}
      </ol>

      <ol
        id={trackId}
        ref={track}
        className="editorial-thread"
        data-active={active}
        tabIndex={0}
        aria-label={label}
      >
        {children}
      </ol>

      <div className="editorial-carousel-arrows">
        <button
          type="button"
          className="editorial-carousel-arrow"
          aria-controls={trackId}
          aria-label="Previous"
          disabled={atStart}
          onClick={() => goTo(Math.max(0, active - 1))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className="editorial-carousel-arrow"
          aria-controls={trackId}
          aria-label="Next"
          disabled={atEnd}
          onClick={() => goTo(Math.min(steps.length - 1, active + 1))}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
