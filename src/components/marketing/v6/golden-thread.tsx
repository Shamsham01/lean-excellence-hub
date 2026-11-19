"use client";

import { useEffect, useRef, useState } from "react";

type Node = { x: number; y: number; stub?: number | undefined };
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

/**
 * The Golden Thread (art direction §0, §8 motion 2): one continuous 2 px
 * line from the hero to the close, drawn as the page scrolls. It runs in
 * the left margin and joins anchors marked with `data-thread` in the page.
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

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const container = root.querySelector<HTMLElement>(".v6-container");
        if (!container) {
          return;
        }
        const cRect = container.getBoundingClientRect();
        const style = getComputedStyle(container);
        const contentLeft =
          cRect.left - rootRect.left + parseFloat(style.paddingLeft);
        const margin = contentLeft;
        const mx = Math.round(
          Math.max(10, contentLeft - Math.min(48, Math.max(10, margin / 2))),
        );
        const rel = (r: DOMRect) => ({
          x: r.left - rootRect.left,
          y: r.top - rootRect.top,
          w: r.width,
          h: r.height,
        });

        const anchors = Array.from(
          root.querySelectorAll<HTMLElement>("[data-thread]"),
        ).filter((el) => el.offsetParent !== null);

        let d = "";
        const nodes: Node[] = [];
        let end: Geometry["end"] = null;
        let cursor: { x: number; y: number } | null = null;

        for (const el of anchors) {
          const kind = el.dataset.thread;
          const r = rel(el.getBoundingClientRect());
          if (kind === "start") {
            const sx = r.x + r.w / 2;
            const sy = r.y + r.h / 2;
            d = `M ${sx} ${sy}`;
            cursor = { x: sx, y: sy };
            continue;
          }
          if (kind === "bend" && cursor) {
            // Drop from the start, then sweep left into the margin.
            const by = r.y + r.h / 2;
            const radius = Math.min(40, Math.abs(cursor.x - mx) / 2);
            d += ` L ${cursor.x} ${by - radius}`;
            d += ` Q ${cursor.x} ${by} ${cursor.x - radius} ${by}`;
            d += ` L ${mx + radius} ${by}`;
            d += ` Q ${mx} ${by} ${mx} ${by + radius}`;
            cursor = { x: mx, y: by + radius };
            continue;
          }
          if (kind === "node" || kind === "stub") {
            const ny = r.y + r.h / 2;
            const gap = Number(el.dataset.threadGap ?? 0);
            d += cursor ? ` L ${mx} ${ny}` : `M ${mx} ${ny}`;
            cursor = { x: mx, y: ny };
            nodes.push({
              x: mx,
              y: ny,
              stub: kind === "stub" ? Math.max(0, r.x - mx - gap) : undefined,
            });
            continue;
          }
          if (kind === "end" && cursor) {
            const ex = r.x + r.w / 2;
            const ey = r.y + r.h / 2;
            const turn = Math.min(160, (ey - cursor.y) / 2);
            d += ` L ${mx} ${ey - turn}`;
            d += ` C ${mx} ${ey} ${mx + (ex - mx) * 0.4} ${ey} ${ex - r.w / 2 - 12} ${ey}`;
            end = { x: ex, y: ey };
          }
        }

        setGeo({
          width: Math.round(rootRect.width),
          height: Math.round(root.scrollHeight),
          d,
          nodes,
          end,
        });
      });
    };

    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
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
          {n.stub ? (
            <line
              className="v6-thread-stub"
              x1={n.x}
              y1={n.y}
              x2={n.x + n.stub}
              y2={n.y}
            />
          ) : null}
          <circle cx={n.x} cy={n.y} r={4} />
        </g>
      ))}
    </svg>
  );
}
