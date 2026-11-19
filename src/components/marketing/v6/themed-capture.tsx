import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import type { CaptureSlot } from "./assets";

type Theme = "light" | "dark";

function srcSet(slot: CaptureSlot, theme: Theme, ext: "avif" | "webp") {
  const full = `${slot.base}-${theme}.${ext} ${slot.width}w`;
  const smaller = (slot.widths ?? []).map(
    (w) => `${slot.base}-${theme}-${w}w.${ext} ${w}w`,
  );
  return [...smaller, full].join(", ");
}

/**
 * Renders the light and the dark capture of one slot. CSS shows the one that
 * matches `html.dark`, so toggling the theme swaps images without a reload
 * and without layout shift (both carry the same intrinsic size).
 */
export function ThemedCapture({
  slot,
  priority = false,
  sizes = "100vw",
  className,
  style,
  decorative = false,
}: {
  slot: CaptureSlot;
  priority?: boolean | undefined;
  sizes?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  decorative?: boolean | undefined;
}) {
  return (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <picture key={theme} className={cn("v6-cap", `cap-${theme}`)}>
          <source
            type="image/avif"
            srcSet={srcSet(slot, theme, "avif")}
            sizes={sizes}
          />
          <img
            src={`${slot.base}-${theme}.webp`}
            srcSet={srcSet(slot, theme, "webp")}
            sizes={sizes}
            width={slot.width}
            height={slot.height}
            alt={decorative ? "" : slot.alt}
            className={className}
            style={style}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            {...(priority ? { fetchPriority: "high" as const } : {})}
          />
        </picture>
      ))}
    </>
  );
}
