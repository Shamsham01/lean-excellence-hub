"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

type EphemeralToastProps = {
  message: string | null;
  tone?: "default" | "error";
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

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-md",
        tone === "error"
          ? "border-destructive/40 bg-card text-destructive"
          : "border-border bg-card text-foreground",
      )}
      role={tone === "error" ? "alert" : "status"}
      data-testid="platform-ephemeral-toast"
    >
      {message}
    </div>
  );
}
