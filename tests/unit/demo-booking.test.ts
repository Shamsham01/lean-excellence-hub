import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  demoEmbedConfig,
  demoEmbedUi,
  readDemoBookingOverride,
  resolveDemoBookingUrl,
} from "@/lib/marketing/demo-booking";

const FIXTURE = "https://cal.com/fixture-organiser/product-demonstration";

describe("resolveDemoBookingUrl", () => {
  it("treats an empty value as unconfigured", () => {
    expect(resolveDemoBookingUrl(undefined)).toEqual({
      status: "unconfigured",
    });
    expect(resolveDemoBookingUrl("")).toEqual({ status: "unconfigured" });
    expect(resolveDemoBookingUrl("   ")).toEqual({ status: "unconfigured" });
  });

  it("accepts an https Cal.com event link and drops query and hash", () => {
    expect(
      resolveDemoBookingUrl(`${FIXTURE}?overlayCalendar=true#book`),
    ).toEqual({
      status: "ready",
      pageUrl: FIXTURE,
      origin: "https://app.cal.com",
      calLink: "fixture-organiser/product-demonstration",
      embedScriptUrl: "https://app.cal.com/embed/embed.js",
    });
  });

  it("canonicalises www and keeps app and EU hosts", () => {
    expect(
      resolveDemoBookingUrl(
        "https://www.cal.com/fixture-organiser/product-demonstration",
      ),
    ).toMatchObject({ origin: "https://app.cal.com", pageUrl: FIXTURE });

    expect(
      resolveDemoBookingUrl(
        "https://app.cal.com/fixture-organiser/product-demonstration",
      ),
    ).toMatchObject({
      status: "ready",
      origin: "https://app.cal.com",
      embedScriptUrl: "https://app.cal.com/embed/embed.js",
    });

    expect(
      resolveDemoBookingUrl(
        "https://cal.eu/fixture-organiser/product-demonstration",
      ),
    ).toMatchObject({
      status: "ready",
      origin: "https://app.cal.eu",
      embedScriptUrl: "https://app.cal.eu/embed/embed.js",
    });
  });

  it("uses the official app.cal.com embed origin for the actual LEH event URL", () => {
    expect(
      resolveDemoBookingUrl("https://cal.com/lean-excellence-hub/demo"),
    ).toMatchObject({
      status: "ready",
      pageUrl: "https://cal.com/lean-excellence-hub/demo",
      origin: "https://app.cal.com",
      calLink: "lean-excellence-hub/demo",
      embedScriptUrl: "https://app.cal.com/embed/embed.js",
    });
  });

  it("rejects anything that is not an approved https booking link", () => {
    const rejected = [
      "http://cal.com/fixture-organiser/product-demonstration",
      "https://user:secret@cal.com/fixture-organiser/product-demonstration",
      "https://cal.com:444/fixture-organiser/product-demonstration",
      "https://cal.com",
      "https://cal.com/",
      "https://cal.com/embed/embed.js",
      "https://evil.example/fixture-organiser/product-demonstration",
      "https://cal.com.evil.example/fixture-organiser/product-demonstration",
      "https://notcal.com/fixture-organiser/product-demonstration",
      "javascript:alert(1)",
      "https://cal.com/fixture%2Forganiser/product-demonstration",
      "https://cal.com/a/b/c/d/e",
    ];

    for (const value of rejected) {
      expect(resolveDemoBookingUrl(value), value).toEqual({
        status: "invalid",
      });
    }
  });

  it("does not ask the embed to treat a callback as confirmation", () => {
    expect(demoEmbedUi("dark")).toMatchObject({
      theme: "dark",
      layout: "month_view",
      disableAutoScroll: true,
    });
    expect(demoEmbedConfig("light").iframeAttrs.title).toMatch(/Cal\.com/);
    expect(demoEmbedConfig("light")).not.toHaveProperty("bookingSuccessful");

    const source = readFileSync(
      "src/components/marketing/demo/booking-calendar.tsx",
      "utf8",
    );
    expect(source).toContain('action: "linkFailed"');
    expect(source).toContain('action: "linkReady"');
    expect(source).not.toContain("bookingSuccessful");
    expect(source).not.toContain("rescheduleBooking");
    expect(source).not.toContain("bookingCancelled");
    expect(source).not.toContain("inlineStarted");
    expect(source).not.toContain("resetDemoBookingEmbedState");
  });
});

describe("readDemoBookingOverride", () => {
  it("keeps the published URL when the test header is empty", () => {
    expect(readDemoBookingOverride(null, undefined)).toEqual({
      status: "unconfigured",
    });
    expect(readDemoBookingOverride("  ", FIXTURE)).toMatchObject({
      status: "ready",
      pageUrl: FIXTURE,
    });
  });

  it("still rejects an unapproved address from the test header", () => {
    expect(
      readDemoBookingOverride(
        "https://evil.example/fixture-organiser/product-demonstration",
        undefined,
      ),
    ).toEqual({ status: "invalid" });
    expect(readDemoBookingOverride(FIXTURE, undefined)).toMatchObject({
      status: "ready",
      pageUrl: FIXTURE,
      embedScriptUrl: "https://app.cal.com/embed/embed.js",
    });
  });
});
