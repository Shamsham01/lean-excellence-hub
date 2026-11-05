import Link from "next/link";
import { cn } from "@/lib/utils";

import {
  LEH_BRAND,
  LEH_BRAND_HOME_LABEL,
  LEH_BRAND_LOCKUP_LABEL,
  type LehBrandMediaAsset,
} from "./brand-assets";
import "./leh-brand.css";

export type LehBrandVariant = "full" | "compact" | "icon";

type LehBrandProps = {
  variant?: LehBrandVariant;
  className?: string;
  /**
   * Hide the mark from assistive tech when a parent control already names
   * Lean Excellence Hub, for example a home link with its own label.
   */
  decorative?: boolean;
  priority?: boolean;
  /**
   * On narrow viewports, a full lockup collapses to the icon plus text so
   * the name stays readable beside other header controls.
   */
  responsive?: boolean;
  strapline?: boolean;
};

type LehBrandPictureProps = {
  asset: LehBrandMediaAsset;
  alt: string;
  imgClassName: string;
  themeClassName: string;
  priority?: boolean;
};

/** SVG-first brand media; PNG masters stay as the `<img>` fallback. */
function LehBrandPicture({
  asset,
  alt,
  imgClassName,
  themeClassName,
  priority = false,
}: LehBrandPictureProps) {
  return (
    <picture className={themeClassName}>
      <source srcSet={asset.src} type="image/svg+xml" />
      <img
        alt={alt}
        className={imgClassName}
        decoding="async"
        height={asset.height}
        loading={priority ? "eager" : "lazy"}
        src={asset.rasterFallbackSrc}
        width={asset.width}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}

export function LehBrand({
  variant = "full",
  className,
  decorative = false,
  priority = false,
  responsive = false,
  strapline = variant !== "icon",
}: LehBrandProps) {
  const showCopy = variant !== "icon";
  const showLockup = variant === "full";
  const showMark = variant !== "full" || responsive;
  const labelledIcon = !decorative && variant === "icon";
  const lockupAlt = decorative ? "" : LEH_BRAND_LOCKUP_LABEL;

  return (
    <span
      className={cn("leh-brand", className)}
      data-responsive={responsive ? "true" : "false"}
      data-testid="leh-brand"
      data-variant={variant}
      {...(decorative ? { "aria-hidden": "true" as const } : {})}
      {...(labelledIcon
        ? { role: "img" as const, "aria-label": LEH_BRAND.name }
        : {})}
    >
      {showLockup ? (
        <span className="leh-brand-lockup">
          <LehBrandPicture
            alt={lockupAlt}
            asset={LEH_BRAND.horizontalLight}
            imgClassName="leh-brand-lockup-img"
            themeClassName="leh-brand-lockup-light"
            priority={priority}
          />
          <LehBrandPicture
            alt={lockupAlt}
            asset={LEH_BRAND.horizontalDark}
            imgClassName="leh-brand-lockup-img"
            themeClassName="leh-brand-lockup-dark"
          />
        </span>
      ) : null}
      {showMark ? (
        <span className="leh-brand-fallback">
          <LehBrandPicture
            alt=""
            asset={LEH_BRAND.iconLight}
            imgClassName="leh-brand-mark"
            themeClassName="leh-brand-mark-light"
            priority={priority && variant !== "full"}
          />
          <LehBrandPicture
            alt=""
            asset={LEH_BRAND.iconDark}
            imgClassName="leh-brand-mark"
            themeClassName="leh-brand-mark-dark"
          />
          {showCopy ? (
            <span className="leh-brand-copy">
              <span className="leh-brand-name">{LEH_BRAND.name}</span>
              {strapline ? (
                <span className="leh-brand-strapline">
                  {LEH_BRAND.strapline}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function LehBrandHomeLink({
  className,
  variant = "full",
}: {
  className?: string;
  variant?: LehBrandVariant;
}) {
  return (
    <Link
      href="/"
      aria-label={LEH_BRAND_HOME_LABEL}
      className={cn("leh-brand-link", className)}
    >
      <LehBrand decorative variant={variant} />
    </Link>
  );
}
