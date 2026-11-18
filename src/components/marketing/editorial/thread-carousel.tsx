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

import { cn } from "@/lib/utils";

/** Left scroll padding: where a snapped slide starts inside the track. */
function inset(element: HTMLElement) {
  return parseFloat(getComputedStyle(element).scrollPaddingLeft) || 0;
}

/**
 * Observe, Act, Solve: a horizontal scroll-snap carousel. Swipe on touch,
 * trackpad or arrow keys on the focused track, or the stage and arrow
 * buttons. Slides keep each capture whole; nothing is cropped.
 */
export function ThreadCarousel({
  label,
  stages,
  children,
}: {
  label: string;
  stages: readonly string[];
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
    if (element.scrollLeft >= max - 2) nearest = slides().length - 1;
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
      className="editorial-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="editorial-carousel-bar">
        <div className="editorial-carousel-stages">
          {stages.map((stage, index) => (
            <button
              key={stage}
              type="button"
              aria-controls={trackId}
              aria-current={active === index ? "step" : undefined}
              className={cn(
                "editorial-carousel-stage",
                active === index && "is-active",
              )}
              onClick={() => goTo(index)}
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {stage}
            </button>
          ))}
        </div>
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
            onClick={() => goTo(Math.min(stages.length - 1, active + 1))}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
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
    </div>
  );
}
