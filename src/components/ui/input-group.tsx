"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/** Input group styling adapted from TailAdmin (MIT — third-party/TAILADMIN-MIT.txt). */

export function InputGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-[10px] border border-border/80 bg-card shadow-[var(--shadow-theme-xs)] transition-colors",
        "has-[[data-slot=input-group-control]:focus-visible]:border-primary/40 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: "inline-start" | "inline-end";
}) {
  return (
    <div
      data-align={align}
      className={cn(
        "flex shrink-0 items-center text-muted-foreground",
        align === "inline-start" ? "ps-3.5" : "pe-3.5",
        className,
      )}
      {...props}
    />
  );
}

export const InputGroupInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function InputGroupInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "h-full min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
