import { CAPTURES, type CaptureSlot } from "./assets";
import { ThemedCapture } from "./themed-capture";

/**
 * Layout width of the <img>, which is wider than the visible column
 * because the 2880×1600 canvas still includes transparent side padding
 * (274 left, 55 right). The stage crops to the visible 2551 px.
 */
const HERO_SIZES =
  "(min-width: 1440px) 709px, (min-width: 1280px) 700px, (min-width: 1024px) 556px, (min-width: 640px) calc((100vw - 64px) * 2880 / 2551), calc((100vw - 40px) * 2880 / 2551)";

/**
 * Preloads the hero's LCP image. The theme follows the system by default,
 * so each preload is scoped to its colour scheme.
 */
function DevicesPreload({ slot }: { slot: CaptureSlot }) {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <link
          key={theme}
          rel="preload"
          as="image"
          type="image/avif"
          href={`${slot.base}-${theme}-1440w.avif`}
          imageSrcSet={`${slot.base}-${theme}-1440w.avif 1440w, ${slot.base}-${theme}.avif ${slot.width}w`}
          imageSizes={HERO_SIZES}
          media={`(prefers-color-scheme: ${theme})`}
          fetchPriority="high"
        />
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
            className="v6-hero-devices-img"
          />
        </div>
      </div>
    </div>
  );
}
