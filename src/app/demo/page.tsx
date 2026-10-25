import type { Metadata } from "next";

import { MarketingDemoPage } from "@/components/marketing/demo/demo-page";
import { readDemoBooking } from "@/lib/marketing/demo-booking";

export const metadata: Metadata = {
  title: "Book a live demo — Lean Excellence Hub",
  description:
    "Book a 45-minute live walkthrough of Lean Excellence Hub. Available times come from Cal.com when a booking link is configured. This page does not invent availability.",
};

export default function DemoPage() {
  return <MarketingDemoPage booking={readDemoBooking()} />;
}
