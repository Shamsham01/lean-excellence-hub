import { cn } from "@/lib/utils";

/**
 * Real product captures (dark, masked, no browser chrome).
 * Each master sits next to smaller copies named `<basename>-<width>w.<ext>`,
 * so a phone never downloads a 2400 px desktop master.
 */
export const captures = {
  // captures-v3 (PIXEL, 18 Nov 2026). Every image appears once on the page.
  // Crops are cut from the v3 masters (real screens, nothing redrawn).
  /** V5 dashboard, cropped to the operational analytics tiles. */
  dashboard: {
    dir: "v3",
    file: "v5-analytics-crop-desktop-dark",
    width: 2248,
    height: 728,
    variants: [800, 1200, 1600],
  },
  /** V1 maturity assessment phone (hero). */
  assessment: {
    dir: "v3",
    file: "v1-maturity-phone-dark",
    width: 1170,
    height: 2100,
    variants: [780],
  },
  /** V7 published maturity result, cropped to levels and pillar scores. */
  results: {
    dir: "v3",
    file: "v7-pillar-scores-crop-dark",
    width: 1990,
    height: 1080,
    variants: [800, 1200],
  },
  // Observe, Act, Solve: v3 dark equivalents, cropped to a 4:5 tile.
  /** V2 5S finding raised on a phone (Observe). */
  threadFinding: {
    dir: "v3",
    file: "v2-five-s-raise-crop-dark",
    width: 1038,
    height: 1297,
    variants: [600],
  },
  /** V4 actions planner, Open column (Act). */
  threadAction: {
    dir: "v3",
    file: "v4-planner-open-crop-dark",
    width: 914,
    height: 1142,
    variants: [600],
  },
  /** V3b cause analysis with LeanAI proposals (Solve). */
  threadCase: {
    dir: "v3",
    file: "v3b-cause-analysis-crop-dark",
    width: 935,
    height: 1169,
    variants: [600],
  },
} satisfies Record<string, CaptureAsset>;

export type CaptureAsset = {
  dir: string;
  file: string;
  width: number;
  height: number;
  /** Widths of the smaller copies that sit next to the master. */
  variants: readonly number[];
};

export function captureBase(asset: CaptureAsset) {
  return `/marketing/captures/${asset.dir}/${asset.file}`;
}

export function captureSrcSet(asset: CaptureAsset, extension: "avif" | "webp") {
  const src = captureBase(asset);
  return [
    ...asset.variants.map((width) => `${src}-${width}w.${extension} ${width}w`),
    `${src}.${extension} ${asset.width}w`,
  ].join(", ");
}

export function Capture({
  asset,
  alt,
  sizes,
  className,
  priority = false,
}: {
  asset: CaptureAsset;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const phone = asset.height / asset.width > 1.5;
  return (
    <picture
      className={cn(
        "lv-capture",
        phone ? "lv-capture-phone" : "lv-capture-desktop",
        className,
      )}
    >
      <source
        srcSet={captureSrcSet(asset, "avif")}
        type="image/avif"
        sizes={sizes}
      />
      {/* Pre-sized variants via srcset; next/image would need a runtime optimiser. */}
      <img
        src={`${captureBase(asset)}.webp`}
        srcSet={captureSrcSet(asset, "webp")}
        sizes={sizes}
        alt={alt}
        width={asset.width}
        height={asset.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}
