import { Fragment } from "react";

import { CAPTURES, type CaptureSlot } from "./assets";
import { ThemedCapture } from "./themed-capture";

/**
 * Layout width of the <img>, which is wider than the visible column
 * because the 2880×1600 canvas still includes transparent side padding
 * (274 left, 55 right). The stage crops to the visible 2551 px.
 * From 1280 the full 2880w file is selected (see fullFromMedia).
 */
const HERO_SIZES =
  "(min-width: 1280px) 880px, (min-width: 1024px) 640px, (min-width: 640px) calc((100vw - 64px) * 2880 / 2551), calc((100vw - 40px) * 2880 / 2551)";

const HERO_FULL_FROM = "(min-width: 1280px)";

/**
 * Preloads the hero's LCP image. The theme follows the system by default,
 * so each preload is scoped to its colour scheme. ≥1280 preloads the
 * 2880-wide file; below that, the 1440w derivative.
 */
function DevicesPreload({ slot }: { slot: CaptureSlot }) {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <Fragment key={theme}>
          <link
            key={`${theme}-full`}
            rel="preload"
            as="image"
            type="image/avif"
            href={`${slot.base}-${theme}.avif`}
            media={`(min-width: 1280px) and (prefers-color-scheme: ${theme})`}
            fetchPriority="high"
          />
          <link
            key={`${theme}-1440`}
            rel="preload"
            as="image"
            type="image/avif"
            href={`${slot.base}-${theme}-1440w.avif`}
            media={`(max-width: 1279px) and (prefers-color-scheme: ${theme})`}
            fetchPriority="high"
          />
        </Fragment>
      ))}
    </>
  );
}

/**
 * Hero visual: a single themed device mockup (desktop, tablet and phone)
 * in place of the three-layer exploded composite.
 */
export function HeroComposite() {
  return (
    <div className="v6-hero-composite">
      <DevicesPreload slot={CAPTURES.heroDevices} />
      <div className="v6-hero-devices">
        <div className="v6-hero-devices-stage">
          <ThemedCapture
            slot={CAPTURES.heroDevices}
            priority
            sizes={HERO_SIZES}
            fullFromMedia={HERO_FULL_FROM}
            className="v6-hero-devices-img"
          />
        </div>
      </div>
    </div>
  );
}
