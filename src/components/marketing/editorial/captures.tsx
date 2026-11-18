import { cn } from "@/lib/utils";

/**
 * Real product captures (dark, masked, no browser chrome).
 * Each master sits next to smaller copies named `<basename>-<width>w.<ext>`,
 * so a phone never downloads a 2400 px desktop master.
 */
export const captures = {
  dashboard: {
    dir: "v2",
    file: "v5-dashboard-home-desktop-dark",
    width: 2400,
    height: 1200,
  },
  assessment: {
    dir: "v2",
    file: "v2-five-s-raise-phone-dark",
    width: 1170,
    height: 2532,
  },
  audit: {
    dir: "v2",
    file: "v2-five-s-raise-phone-dark",
    width: 1170,
    height: 2532,
  },
  planner: {
    dir: "v2",
    file: "v4-actions-planner-desktop-dark",
    width: 2400,
    height: 1600,
  },
  results: null as CaptureAsset | null,
  analysis: {
    dir: "v2",
    file: "v3b-pps-analysis-desktop-dark",
    width: 2400,
    height: 1600,
  },
  finding: {
    dir: "v2",
    file: "v6-gemba-finding-dark",
    width: 2400,
    height: 1600,
  },
  case: {
    dir: "v2",
    file: "v3-pps-case-desktop-dark",
    width: 2400,
    height: 1600,
  },
} satisfies Record<string, CaptureAsset | null>;

export type CaptureAsset = {
  dir: string;
  file: string;
  width: number;
  height: number;
};

const PHONE_VARIANT_WIDTHS = [780] as const;
const DESKTOP_VARIANT_WIDTHS = [800, 1200] as const;

export function captureBase(asset: CaptureAsset) {
  return `/marketing/captures/${asset.dir}/${asset.file}`;
}

export function captureSrcSet(asset: CaptureAsset, extension: "avif" | "webp") {
  const src = captureBase(asset);
  const variants =
    asset.width >= 2400 ? DESKTOP_VARIANT_WIDTHS : PHONE_VARIANT_WIDTHS;
  return [
    ...variants.map((width) => `${src}-${width}w.${extension} ${width}w`),
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
  const phone = asset.width < asset.height;
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
