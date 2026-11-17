"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { StatusChip } from "@/components/marketing/primitives";

import { landingCopy } from "@/lib/marketing/landing-copy";

const { assigned, verified } = landingCopy.action;

export function HeroStatusCycle() {
  const [status, setStatus] = useState<typeof assigned | typeof verified>(
    assigned,
  );

  useEffect(() => {
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = prefersReduced ? 0 : 2_400;
    const timer = window.setTimeout(() => setStatus(verified), delay);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="editorial-hero-status-cycle"
      role="status"
      aria-live="polite"
    >
      {status === assigned ? (
        <StatusChip tone="accent">{assigned}</StatusChip>
      ) : (
        <span className="editorial-hero-status-verified-chip">
          <Check aria-hidden="true" className="editorial-hero-status-check" />
          <StatusChip tone="success">{verified}</StatusChip>
        </span>
      )}
    </div>
  );
}
