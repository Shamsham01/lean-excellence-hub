import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { LehBrand } from "@/components/brand/leh-brand";
import { Button } from "@/components/ui/button";
import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";
import { cn } from "@/lib/utils";

export function MarketingContainer({
  className,
  wide = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        wide ? "marketing-container-wide" : "marketing-container",
        className,
      )}
      {...props}
    />
  );
}

export function MarketingSection({
  className,
  flush = false,
  ...props
}: HTMLAttributes<HTMLElement> & { flush?: boolean }) {
  return (
    <section
      className={cn(!flush && "marketing-section", className)}
      {...props}
    />
  );
}

export function MarketingKicker({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("marketing-kicker", className)} {...props} />;
}

export function MarketingSurface({
  className,
  featured = false,
  ...props
}: HTMLAttributes<HTMLElement> & { featured?: boolean }) {
  return (
    <article
      className={cn(
        "marketing-surface p-5 sm:p-6",
        featured &&
          "border-primary/25 bg-[color-mix(in_oklab,var(--accent)_55%,var(--card))]",
        className,
      )}
      {...props}
    />
  );
}

export function MarketingWordmark({
  compact = false,
  decorative = false,
  priority = false,
}: {
  compact?: boolean;
  decorative?: boolean;
  priority?: boolean;
}) {
  return (
    <LehBrand
      className={cn(!compact && "leh-brand--contained-lockup")}
      decorative={decorative}
      lockupOnDarkSurface={!compact}
      lockupRasterOnly={!compact}
      priority={priority}
      strapline={!compact}
      variant={compact ? "compact" : "full"}
    />
  );
}

export function RequestDemoControl({
  size = "default",
  className,
}: {
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Button asChild size={size} className={cn("marketing-cta", className)}>
      <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
    </Button>
  );
}

/** Scrolls to the early-access form on the landing page. */
export function GetFreeAccessControl({
  size = "default",
  className,
}: {
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Button
      asChild
      size={size}
      variant="outline"
      className={cn("marketing-cta-outline", className)}
    >
      <Link href={GET_FREE_ACCESS_HREF}>{GET_FREE_ACCESS_CTA}</Link>
    </Button>
  );
}

export function SectionIntro({
  kicker,
  title,
  children,
  titleAs = "h2",
}: {
  kicker?: string;
  title: string;
  children?: ReactNode;
  titleAs?: "h2" | "h3";
}) {
  const Title = titleAs;

  return (
    <div className="max-w-3xl">
      {kicker ? <MarketingKicker>{kicker}</MarketingKicker> : null}
      <Title className={cn("marketing-heading", kicker && "mt-3")}>
        {title}
      </Title>
      {children ? (
        <div className="marketing-copy mt-4 text-[1.02rem] leading-7">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function PreviewCaption({ children }: { children: ReactNode }) {
  return (
    <figcaption className="marketing-preview-caption">{children}</figcaption>
  );
}

export function StatusChip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "connected" | "warning" | "success" | "danger";
  className?: string;
}) {
  return (
    <span className={cn("marketing-chip", `marketing-chip-${tone}`, className)}>
      {children}
    </span>
  );
}
