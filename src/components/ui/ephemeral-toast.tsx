"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

type EphemeralToastProps = {
  message: string | null;
  tone?: "default" | "success" | "warning" | "error" | "info";
  onDismiss: () => void;
  durationMs?: number;
};

export function EphemeralToast({
  message,
  tone = "default",
  onDismiss,
  durationMs = 4500,
}: EphemeralToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const toneClasses: Record<NonNullable<EphemeralToastProps["tone"]>, string> = {
    default: "border-border bg-card text-foreground",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-information/40 bg-information/10 text-information",
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border px-4 py-3 text-sm wrap-break-word shadow-md sm:inset-x-auto sm:right-4",
        toneClasses[tone],
      )}
      role={tone === "error" ? "alert" : "status"}
      data-testid="platform-ephemeral-toast"
    >
      {message}
    </div>
  );
}
