"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { StatusChip } from "@/components/marketing/primitives";

export function HeroStatusCycle() {
  const [status, setStatus] = useState<"Assigned" | "Verified">("Assigned");

  useEffect(() => {
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = prefersReduced ? 0 : 2_400;
    const timer = window.setTimeout(() => setStatus("Verified"), delay);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="editorial-hero-status-cycle"
      role="status"
      aria-live="polite"
    >
      {status === "Assigned" ? (
        <StatusChip tone="accent">Assigned</StatusChip>
      ) : (
        <span className="editorial-hero-status-verified-chip">
          <Check aria-hidden="true" className="editorial-hero-status-check" />
          <StatusChip tone="success">Verified</StatusChip>
        </span>
      )}
    </div>
  );
}
