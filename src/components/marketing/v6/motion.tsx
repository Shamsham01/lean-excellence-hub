"use client";

import { useEffect } from "react";

/**
 * Reveal-on-scroll, radar draw and header state (art direction §7).
 * Content is only hidden while `html.js` is present, so without JS (or
 * before hydration fails) everything stays visible.
 */
export function V6Motion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) {
      return;
    }
    document.documentElement.classList.add("js");

    // Decorative hero art (G1) waits for the page — and its LCP planner —
    // to finish loading (review r1 ruling #28).
    const showArt = () => document.documentElement.classList.add("v6-art");
    if (document.readyState === "complete") {
      showArt();
    } else {
      window.addEventListener("load", showArt, { once: true });
    }

    const reveal = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const inView = (el: HTMLElement) => {
      el.classList.add("is-in");
    };
    if (!("IntersectionObserver" in window)) {
      reveal.forEach(inView);
      root
        .querySelectorAll<HTMLElement>("[data-radar]")
        .forEach((el) => el.classList.add("is-drawn"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    reveal.forEach((el) => io.observe(el));

    const radarEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-radar]"),
    );
    const radarIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.add("is-drawn");
            countUp(el);
            radarIo.unobserve(el);
          }
        });
      },
      { threshold: 0.4 },
    );
    radarEls.forEach((el) => radarIo.observe(el));

    return () => {
      window.removeEventListener("load", showArt);
      io.disconnect();
      radarIo.disconnect();
    };
  }, [rootId]);

  return null;
}

function countUp(scope: HTMLElement) {
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = Array.from(scope.querySelectorAll<HTMLElement>("[data-count]"));
  if (reduced) {
    return;
  }
  const start = performance.now();
  const duration = 700;
  els.forEach((el) => {
    el.textContent = "0.0";
  });
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    els.forEach((el) => {
      const target = Number(el.dataset.count);
      el.textContent = (target * eased).toFixed(1);
    });
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}
