import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import {
  LEH_BRAND,
  LEH_BRAND_HOME_LABEL,
  LEH_BRAND_LOCKUP_LABEL,
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

const lockupCropStyle = {
  "--leh-crop-x": String(LEH_BRAND.horizontalCrop.x),
  "--leh-crop-y": String(LEH_BRAND.horizontalCrop.y),
  "--leh-crop-w": String(LEH_BRAND.horizontalCrop.width),
  "--leh-crop-h": String(LEH_BRAND.horizontalCrop.height),
  "--leh-src-w": String(LEH_BRAND.horizontalFrame.width),
  "--leh-src-h": String(LEH_BRAND.horizontalFrame.height),
} as CSSProperties;

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
        <span className="leh-brand-lockup" style={lockupCropStyle}>
          <Image
            alt={lockupAlt}
            className="leh-brand-lockup-img leh-brand-lockup-light"
            height={LEH_BRAND.horizontalLight.height}
            priority={priority}
            sizes="22rem"
            src={LEH_BRAND.horizontalLight.src}
            width={LEH_BRAND.horizontalLight.width}
          />
          <Image
            alt={lockupAlt}
            className="leh-brand-lockup-img leh-brand-lockup-dark"
            fetchPriority={priority ? "low" : undefined}
            height={LEH_BRAND.horizontalDark.height}
            loading={priority ? "eager" : undefined}
            sizes="22rem"
            src={LEH_BRAND.horizontalDark.src}
            width={LEH_BRAND.horizontalDark.width}
          />
        </span>
      ) : null}
      {showMark ? (
        <span className="leh-brand-fallback">
          <Image
            alt=""
            className="leh-brand-mark leh-brand-mark-light"
            height={LEH_BRAND.iconLight.height}
            priority={priority && variant !== "full"}
            sizes="2rem"
            src={LEH_BRAND.iconLight.src}
            width={LEH_BRAND.iconLight.width}
          />
          <Image
            alt=""
            className="leh-brand-mark leh-brand-mark-dark"
            height={LEH_BRAND.iconDark.height}
            sizes="2rem"
            src={LEH_BRAND.iconDark.src}
            width={LEH_BRAND.iconDark.width}
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
