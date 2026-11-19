"use client";

import { useEffect, useRef } from "react";

import { CAPTURES } from "./assets";
import { Handset } from "./handset";
import { ProductWindow } from "./product-window";

/**
 * Hero composite (art direction §6.1): an exploded 3-D stack of three real
 * screens at ≥1024 px, flat and overlapped below. Pointer parallax is
 * limited to 3° and only runs for fine pointers without reduced motion.
 */
export function HeroComposite() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof window.matchMedia !== "function") {
      return;
    }
    const fine = window.matchMedia(
      "(pointer: fine) and (min-width: 1280px) and (prefers-reduced-motion: no-preference)",
    );
    if (!fine.matches) {
      return;
    }
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let frame = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      scene.style.setProperty("--px", `${cx.toFixed(3)}deg`);
      scene.style.setProperty("--py", `${cy.toFixed(3)}deg`);
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        frame = requestAnimationFrame(loop);
      } else {
        frame = 0;
      }
    };
    const onMove = (event: PointerEvent) => {
      const r = scene.getBoundingClientRect();
      const nx = (event.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const ny = (event.clientY - (r.top + r.height / 2)) / window.innerHeight;
      tx = Math.max(-3, Math.min(3, nx * 6));
      ty = Math.max(-3, Math.min(3, -ny * 6));
      if (!frame) {
        frame = requestAnimationFrame(loop);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="v6-hero-composite" ref={sceneRef}>
      <div className="v6-hero-stage">
        <div className="v6-hero-layer v6-hero-l1">
          <ProductWindow
            slot={CAPTURES.heroDashboard}
            priority
            sizes="(min-width: 1024px) 760px, 100vw"
            className="v6-hero-dashboard"
          />
          <ProductWindow
            slot={CAPTURES.heroDashboardKpi}
            priority
            sizes="100vw"
            className="v6-hero-kpi"
          />
        </div>
        <div className="v6-hero-layer v6-hero-l2">
          <ProductWindow
            slot={CAPTURES.heroPlanner}
            sizes="(min-width: 1024px) 440px, 60vw"
          />
        </div>
        <div className="v6-hero-layer v6-hero-l3">
          <Handset
            slot={CAPTURES.heroPhone}
            sizes="(min-width: 768px) 210px, 44vw"
          >
            <span className="v6-spark" aria-hidden="true" />
          </Handset>
          <span className="v6-hero-thread-start" data-thread="start" />
        </div>
      </div>
    </div>
  );
}
