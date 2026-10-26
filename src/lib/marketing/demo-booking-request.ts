import "server-only";

import { headers } from "next/headers";

import {
  DEMO_BOOKING_E2E_HEADER,
  readDemoBookingOverride,
} from "@/lib/marketing/demo-booking";

/**
 * Playwright-only booking URL. Call this only when `DEMO_BOOKING_E2E=1`.
 * `headers()` opts the route out of static rendering, so production must
 * not import this module.
 */
export async function readDemoBookingForE2E() {
  const requestHeaders = await headers();
  return readDemoBookingOverride(requestHeaders.get(DEMO_BOOKING_E2E_HEADER));
}
