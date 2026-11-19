"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { LEAN_BEATS } from "./content";

/** LeanAI beats; the beat nearest the viewport centre is highlighted. */
export function LeanAiBeats() {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const items = Array.from(list.querySelectorAll<HTMLElement>("li"));
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = window.innerHeight * 0.5;
        let best = 0;
        let bestDist = Infinity;
        items.forEach((item, index) => {
          const r = item.getBoundingClientRect();
          const dist = Math.abs(r.top + r.height / 2 - mid);
          if (dist < bestDist) {
            bestDist = dist;
            best = index;
          }
        });
        setActive(best);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <ol className="v6-beats" ref={listRef}>
      {LEAN_BEATS.map((beat, index) => (
        <li key={beat.index} className={cn(index === active && "is-active")}>
          <span className="v6-kicker">{beat.index}</span>
          <h3 className="v6-h3">{beat.title}</h3>
          <p>{beat.body}</p>
        </li>
      ))}
    </ol>
  );
}
