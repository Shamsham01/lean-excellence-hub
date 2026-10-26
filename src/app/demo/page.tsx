import type { Metadata } from "next";

import { MarketingDemoPage } from "@/components/marketing/demo/demo-page";
import { readDemoBooking } from "@/lib/marketing/demo-booking";

export const metadata: Metadata = {
  title: "Book a live demo — Lean Excellence Hub",
  description:
    "Book a 45-minute live walkthrough of Lean Excellence Hub. Available times come from Cal.com when a booking link is configured. This page does not invent availability.",
};

export default async function DemoPage() {
  if (process.env.DEMO_BOOKING_E2E === "1") {
    const { readDemoBookingForE2E } =
      await import("@/lib/marketing/demo-booking-request");
    return <MarketingDemoPage booking={await readDemoBookingForE2E()} />;
  }

  return <MarketingDemoPage booking={readDemoBooking()} />;
}
