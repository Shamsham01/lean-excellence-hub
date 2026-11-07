"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "role" | "type" | "onChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "default" | "sm";
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked = false,
      disabled,
      onCheckedChange,
      onClick,
      size = "default",
      ...props
    },
    ref,
  ) => {
    const dimensions =
      size === "sm"
        ? "h-5 w-9 [&>span]:size-4 [&>span]:data-[state=on]:translate-x-4"
        : "h-6 w-11 [&>span]:size-5 [&>span]:data-[state=on]:translate-x-5";

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-state={checked ? "on" : "off"}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted",
          dimensions,
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled) return;
          onCheckedChange?.(!checked);
        }}
        {...props}
      >
        <span
          data-state={checked ? "on" : "off"}
          className="pointer-events-none block translate-x-0 rounded-full bg-card shadow-[var(--shadow-theme-xs)] transition-transform duration-150"
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
