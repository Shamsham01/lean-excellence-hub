import type { Metadata } from "next";

import { MarketingDemoPage } from "@/components/marketing/demo/demo-page";
import { readDemoBooking } from "@/lib/marketing/demo-booking";

export const metadata: Metadata = {
  title: "Book a demo — Lean Excellence Hub",
  description:
    "Book a 30-minute live walkthrough of Lean Excellence Hub on Cal.com, or get free access during early access.",
};

export default async function DemoPage() {
  if (process.env.DEMO_BOOKING_E2E === "1") {
    const { readDemoBookingForE2E } =
      await import("@/lib/marketing/demo-booking-request");
    return <MarketingDemoPage booking={await readDemoBookingForE2E()} />;
  }

  return <MarketingDemoPage booking={readDemoBooking()} />;
}
