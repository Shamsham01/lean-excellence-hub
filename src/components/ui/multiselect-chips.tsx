"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MultiselectOption = { value: string; label: string };

export function MultiselectChips({
  options,
  value,
  onChange,
  placeholder = "Select items",
  disabled,
  className,
}: {
  options: MultiselectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  const selected = options.filter((o) => value.includes(o.value));

  return (
    <div className={cn("relative flex min-w-0 flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1.5 text-left text-sm shadow-xs",
          "focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-expanded={open}
        aria-disabled={disabled}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((v) => !v);
          }
        }}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        {selected.length === 0 ? (
          <span className="px-1 text-muted-foreground">{placeholder}</span>
        ) : (
          selected.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {item.label}
              <button
                type="button"
                className="rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${item.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(item.value);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      {open ? (
        <div className="z-20 rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-theme-md)]">
          <ul className="max-h-48 overflow-y-auto">
            {options.map((option) => {
              const checked = value.includes(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                      checked && "bg-primary/5 text-foreground",
                    )}
                    onClick={() => toggle(option.value)}
                  >
                    {option.label}
                    {checked ? (
                      <span className="text-xs text-primary">Selected</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border/50 p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
