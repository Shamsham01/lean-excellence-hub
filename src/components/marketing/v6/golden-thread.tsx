"use client";

import { useEffect, useRef, useState } from "react";

type Node = { x: number; y: number };
type Geometry = {
  width: number;
  height: number;
  d: string;
  nodes: Node[];
  end: { x: number; y: number } | null;
};

const EMPTY: Geometry = { width: 0, height: 0, d: "", nodes: [], end: null };

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The thread only runs where the left gutter can hold it (§ review B4). */
const THREAD_MEDIA = "(min-width: 1280px)";
/** Distance from the container's content edge to the line. */
const GUTTER_OFFSET = 40;
/** Radius of the closing curve into the LEH icon (ATELIER r2 m2). */
const CURVE = 120;

/**
 * The Golden Thread (art direction §0, ATELIER review r1 B4): one straight
 * vertical line in the left gutter, 40 px left of the container edge, with a
 * node beside each section kicker (`data-thread="node"`). Its only
 * excursion is the carousel rail (`data-thread="stub"`), reached by a
 * horizontal spur. ≥1280 only; drawn as the page scrolls.
 */
export function GoldenThread({ rootId }: { rootId: string }) {
  const [geo, setGeo] = useState<Geometry>(EMPTY);
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) {
      return;
    }
    const wide =
      typeof window.matchMedia === "function"
        ? window.matchMedia(THREAD_MEDIA)
        : null;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!wide?.matches) {
          setGeo(EMPTY);
          return;
        }
        const rootRect = root.getBoundingClientRect();
        const container = root.querySelector<HTMLElement>(".v6-container");
        if (!container) {
          return;
        }
        const cRect = container.getBoundingClientRect();
        const contentLeft =
          cRect.left -
          rootRect.left +
          parseFloat(getComputedStyle(container).paddingLeft);
        const x = Math.round(Math.max(8, contentLeft - GUTTER_OFFSET)) + 0.5;

        const anchors = Array.from(
          root.querySelectorAll<HTMLElement>("[data-thread]"),
        ).filter((el) => el.offsetParent !== null);

        const nodes: Node[] = [];
        let spur: { y: number; x: number } | null = null;
        let end: { x: number; y: number } | null = null;
        let top = Infinity;
        let bottom = -Infinity;
        for (const el of anchors) {
          const r = el.getBoundingClientRect();
          // Inside a pinned (sticky) stage, measure where the anchor sits at
          // pin start, so the line never depends on the scroll position.
          const stage = el.closest<HTMLElement>("[data-pin-stage]");
          const pinTrack = stage?.closest<HTMLElement>("[data-pin-track]");
          const shift =
            stage && pinTrack
              ? pinTrack.getBoundingClientRect().top -
                stage.getBoundingClientRect().top
              : 0;
          const y =
            Math.round(r.top + shift - rootRect.top + r.height / 2) + 0.5;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          if (el.dataset.thread === "end") {
            // The LEH icon at the close: the thread curves into its halo.
            const halo = 16;
            end = { x: Math.round(r.left - rootRect.left - halo), y };
            bottom = Math.max(bottom, y);
            continue;
          }
          if (el.dataset.thread === "stub") {
            const rx = Math.round(r.left - rootRect.left);
            spur = { y, x: rx };
          } else {
            nodes.push({ x, y });
          }
        }
        if (!Number.isFinite(top) || bottom <= top) {
          setGeo(EMPTY);
          return;
        }

        setGeo({
          width: Math.round(rootRect.width),
          height: Math.round(root.scrollHeight),
          // Down to the rail, across it, then on down to the close, where
          // a 120 px curve turns the line into the LEH icon's halo.
          d: [
            `M ${x} ${top}`,
            spur
              ? `L ${x} ${spur.y} L ${spur.x} ${spur.y} M ${x} ${spur.y}`
              : "",
            end && end.x > x + CURVE
              ? `L ${x} ${end.y - CURVE} Q ${x} ${end.y} ${x + CURVE} ${end.y} L ${end.x} ${end.y}`
              : `L ${x} ${bottom}`,
          ]
            .filter(Boolean)
            .join(" "),
          nodes,
          end: null,
        });
      });
    };

    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    window.addEventListener("resize", measure);
    // Reveal transitions move anchors by a few px; re-measure once they end.
    root.addEventListener("transitionend", measure);
    wide?.addEventListener?.("change", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      root.removeEventListener("transitionend", measure);
      wide?.removeEventListener?.("change", measure);
    };
  }, [rootId]);

  // Scroll-linked draw.
  useEffect(() => {
    const path = pathRef.current;
    const svg = svgRef.current;
    if (!path || !svg || !geo.d) {
      return;
    }
    if (typeof path.getTotalLength !== "function") {
      return;
    }
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    const reduced = prefersReducedMotion();
    if (reduced) {
      path.style.strokeDashoffset = "0";
      svg.querySelectorAll(".v6-thread-node").forEach((n) => {
        n.classList.add("is-reached");
      });
      return;
    }

    // y -> length lookup (the path is monotonic in y apart from the hero bend).
    const samples: { y: number; l: number }[] = [];
    const steps = 240;
    let maxY = -Infinity;
    for (let i = 0; i <= steps; i += 1) {
      const l = (length * i) / steps;
      const p = path.getPointAtLength(l);
      maxY = Math.max(maxY, p.y);
      samples.push({ y: maxY, l });
    }
    const nodes = Array.from(
      svg.querySelectorAll<SVGGElement>(".v6-thread-node"),
    );

    let frame = 0;
    let maxDrawn = 0;
    let reachedY = -Infinity;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = svg.getBoundingClientRect().top;
        reachedY = Math.max(reachedY, window.innerHeight * 0.62 - top);
        const y = reachedY;
        let drawn = 0;
        for (const s of samples) {
          if (s.y <= y) {
            drawn = s.l;
          } else {
            break;
          }
        }
        maxDrawn = Math.max(maxDrawn, drawn);
        path.style.strokeDashoffset = `${length - maxDrawn}`;
        nodes.forEach((n) => {
          const ny = Number(n.dataset.y);
          n.classList.toggle("is-reached", ny <= y);
        });
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [geo]);

  if (!geo.d) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="v6-thread"
      width={geo.width}
      height={geo.height}
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="v6-thread-gradient"
          x1="0"
          y1="0"
          x2="0"
          y2={geo.height}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: "var(--thread-a)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--thread-b)" }} />
          <stop offset="1" style={{ stopColor: "var(--thread-a)" }} />
        </linearGradient>
      </defs>
      <path className="v6-thread-track" d={geo.d} />
      <path ref={pathRef} className="v6-thread-line" d={geo.d} />
      {geo.nodes.map((n) => (
        <g
          key={`${n.x}-${n.y}`}
          className="v6-thread-node"
          data-y={n.y}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <circle cx={n.x} cy={n.y} r={4} />
        </g>
      ))}
    </svg>
  );
}
