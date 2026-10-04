import type { Metadata } from "next";

import { MarketingDemoPage } from "@/components/marketing/home";

export const metadata: Metadata = {
  title: "Request a demo — Lean Excellence Hub",
  description:
    "See how Lean Excellence Hub can connect your Continuous Improvement system. A structured product walkthrough, not a fake booking calendar.",
};

export default function DemoPage() {
  return <MarketingDemoPage />;
}
