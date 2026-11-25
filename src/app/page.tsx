import type { Metadata } from "next";

import { MarketingHome } from "@/components/marketing/home";

export const metadata: Metadata = {
  title:
    "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
  description:
    "Run maturity, Gemba, 5S, suggestions, problem solving, improvement projects, capability and benefits in one connected Operational Excellence platform.",
};

export default function Home() {
  return <MarketingHome />;
}
