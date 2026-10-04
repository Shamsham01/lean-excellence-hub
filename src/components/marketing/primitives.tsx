import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
          "border-primary/25 bg-[color-mix(in_oklch,var(--accent)_55%,var(--card))]",
        className,
      )}
      {...props}
    />
  );
}

export function MarketingMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("marketing-mark", className)}
      fill="none"
      viewBox="0 0 32 32"
    >
      <rect
        x="3.25"
        y="3.25"
        width="10.5"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="18.25"
        y="3.25"
        width="10.5"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3.25"
        y="18.25"
        width="10.5"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="18.25"
        y="18.25"
        width="10.5"
        height="10.5"
        rx="2.2"
        fill="var(--primary)"
        stroke="var(--primary)"
        strokeWidth="1.5"
      />
      <path
        d="M13.8 8.5h4.4M8.5 13.8v4.4M23.5 13.8v4.4M13.8 23.5h4.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MarketingWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-foreground">
      <MarketingMark />
      <span className="flex flex-col leading-none">
        <span className="text-[0.92rem] font-semibold tracking-tight">
          Lean Excellence Hub
        </span>
        {compact ? null : (
          <span className="mt-1 hidden text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase lg:block">
            Continuous Improvement OS
          </span>
        )}
      </span>
    </span>
  );
}

export function RequestDemoControl({
  size = "default",
  className,
}: {
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Button asChild size={size} className={className}>
      <Link href="/demo">Request a demo</Link>
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
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "success" | "danger";
}) {
  return (
    <span className={cn("marketing-chip", `marketing-chip-${tone}`)}>
      {children}
    </span>
  );
}
