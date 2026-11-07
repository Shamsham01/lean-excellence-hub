import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Card layout adapted from TailAdmin (MIT — third-party/TAILADMIN-MIT.txt). */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "group/card flex flex-col gap-5 overflow-hidden rounded-xl border border-border/50 bg-card p-5 text-card-foreground shadow-[var(--shadow-theme-xs)] sm:p-6 dark:bg-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  divided,
  ...props
}: HTMLAttributes<HTMLDivElement> & { divided?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 group-data-[size=sm]/card:gap-1",
        divided && "-mx-5 border-b border-border/50 px-5 pb-4 sm:-mx-6 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardDivider({ className }: { className?: string }) {
  return <div className={cn("-mx-5 h-px bg-border/50 sm:-mx-6", className)} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-medium tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center border-t border-border/50 pt-4",
        className,
      )}
      {...props}
    />
  );
}
