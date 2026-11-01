import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LEH_BRAND, LEH_BRAND_HOME_LABEL } from "./brand-assets";
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

export function LehBrand({
  variant = "full",
  className,
  decorative = false,
  priority = false,
  responsive = false,
  strapline = variant !== "icon",
}: LehBrandProps) {
  const showCopy = variant !== "icon";
  const labelledIcon = !decorative && variant === "icon";
  const lockupAlt = !decorative && variant === "full" ? LEH_BRAND.name : "";

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
      <Image
        alt=""
        className="leh-brand-mark leh-brand-mark-blue"
        height={LEH_BRAND.iconBlue.height}
        priority={priority && variant !== "full"}
        src={LEH_BRAND.iconBlue.src}
        width={LEH_BRAND.iconBlue.width}
      />
      <Image
        alt=""
        className="leh-brand-mark leh-brand-mark-minimal"
        height={LEH_BRAND.iconMinimal.height}
        src={LEH_BRAND.iconMinimal.src}
        width={LEH_BRAND.iconMinimal.width}
      />
      {variant === "full" ? (
        <Image
          alt={lockupAlt}
          className="leh-brand-lockup"
          height={LEH_BRAND.horizontal.height}
          priority={priority}
          sizes="(max-width: 40rem) 240px, 280px"
          src={LEH_BRAND.horizontal.src}
          width={LEH_BRAND.horizontal.width}
        />
      ) : null}
      {showCopy ? (
        <span className="leh-brand-copy">
          <span className="leh-brand-name">{LEH_BRAND.name}</span>
          {strapline ? (
            <span className="leh-brand-strapline">{LEH_BRAND.strapline}</span>
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
