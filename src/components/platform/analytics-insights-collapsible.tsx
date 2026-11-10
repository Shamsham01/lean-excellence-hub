"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function AnalyticsInsightsCollapsible({
  title = "Performance",
  children,
  defaultOpen = false,
  testId = "analytics-insights-collapsible",
  onOpenChange,
}: {
  title?: string;
  children: ReactNode | null;
  defaultOpen?: boolean;
  testId?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const toggle = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className="flex flex-col gap-3" data-testid={testId}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm font-semibold text-foreground shadow-xs transition hover:bg-muted/40"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`${testId}-toggle`}
        onClick={() => toggle(!open)}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn("flex flex-col gap-4", !open && "hidden")}
      >
        {open ? children : null}
      </div>
    </section>
  );
}
