import type { CSSProperties } from "react";

import { CAPTURES, OPTIONAL_CAPTURES, type CaptureSlot } from "./assets";
import { Handset } from "./handset";
import { ProductWindow } from "./product-window";

const ratio = (slot: CaptureSlot) => (slot.height / slot.width).toFixed(4);

/**
 * Preloads the hero's LCP image (review r1 ruling #28). The theme follows
 * the system by default, so each preload is scoped to its colour scheme.
 */
function PlannerPreload({ slot }: { slot: CaptureSlot }) {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <link
          key={theme}
          rel="preload"
          as="image"
          type="image/avif"
          href={`${slot.base}-${theme}.avif`}
          media={`(min-width: 768px) and (prefers-color-scheme: ${theme})`}
          fetchPriority="high"
        />
      ))}
    </>
  );
}

/**
 * Hero composite (ATELIER review r1 B1). ≥768: a flat, fully opaque stack —
 * the planner at the back, the KPI fragment in the middle (when exported)
 * offset down-left, and the phone in front at the bottom-left overlapping
 * the planner by about 30 %. <768: the phone alone, centred.
 * Every proportion comes from the capture files.
 */
export function HeroComposite() {
  const kpi = OPTIONAL_CAPTURES.heroKpi;
  const style = {
    "--planner-r": ratio(CAPTURES.heroPlanner),
    "--phone-r": ratio(CAPTURES.heroPhone),
    ...(kpi ? { "--kpi-r": ratio(kpi) } : {}),
  } as CSSProperties;

  return (
    <div className="v6-hero-composite" style={style}>
      <PlannerPreload slot={CAPTURES.heroPlanner} />
      <div className="v6-hero-stage">
        <div className="v6-hero-layer v6-hero-l1">
          <ProductWindow
            slot={CAPTURES.heroPlanner}
            priority
            sizes="(min-width: 768px) 620px, 1px"
          />
        </div>
        {kpi ? (
          <div className="v6-hero-layer v6-hero-l2">
            <ProductWindow slot={kpi} sizes="420px" />
          </div>
        ) : null}
        <div className="v6-hero-layer v6-hero-l3">
          <Handset slot={CAPTURES.heroPhone} priority sizes="300px">
            <span className="v6-spark" aria-hidden="true" />
          </Handset>
        </div>
      </div>
    </div>
  );
}
