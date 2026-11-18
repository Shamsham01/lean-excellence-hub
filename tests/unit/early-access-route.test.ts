import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/early-access/route";
import { earlyAccessRateLimiter } from "@/lib/marketing/rate-limit";

const WEBHOOK = "https://hook.eu1.make.com/test-only";

const valid = {
  fullName: "Alex Morgan",
  workEmail: "alex@example.com",
  company: "Example Foods",
  role: "CI Manager",
  sites: "3",
  employees: "50–249",
  ciAreas: ["Actions"],
  consent: true,
  marketingOptIn: false,
  website: "",
  sourcePage: "/",
};

function request(
  body: unknown,
  headers: Record<string, string> = {},
  raw?: string,
) {
  return new NextRequest("https://leanexcellencehub.com/api/early-access", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "leanexcellencehub.com",
      origin: "https://leanexcellencehub.com",
      "x-nf-client-connection-ip": "203.0.113.7",
      ...headers,
    },
    body: raw ?? JSON.stringify(body),
  });
}

describe("POST /api/early-access", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    earlyAccessRateLimiter.reset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("Accepted", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MAKE_EARLY_ACCESS_WEBHOOK_URL", WEBHOOK);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("validates and forwards the submission with consent records", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(WEBHOOK);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({
      fullName: "Alex Morgan",
      workEmail: "alex@example.com",
      sites: 3,
      employees: "50–249",
      ciAreas: ["Actions"],
      consent: true,
      termsAccepted: true,
      contactConsent: true,
      marketingOptIn: false,
      marketingOptInAt: null,
      sourcePage: "/",
    });
    expect(new Date(payload.consentAt).toISOString()).toBe(payload.consentAt);
    expect(payload.submittedAt).toBe(payload.consentAt);
    expect(payload).not.toHaveProperty("website");
  });

  it("returns 503 not configured when the webhook env var is unset", async () => {
    vi.stubEnv("MAKE_EARLY_ACCESS_WEBHOOK_URL", "");
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("not_configured");
    expect(body.message).toMatch(/not switched on yet/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a non-https webhook URL as not configured", async () => {
    vi.stubEnv("MAKE_EARLY_ACCESS_WEBHOOK_URL", "http://hook.example.com/x");
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns field errors for an invalid submission", async () => {
    const response = await POST(
      request({ ...valid, sites: "0", consent: false }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.fields).toEqual({
      sites: "Enter the number of sites.",
      consent: "Please tick the box to continue.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quietly drops honeypot submissions", async () => {
    const response = await POST(
      request({ ...valid, website: "https://spam.example" }),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin posts", async () => {
    const response = await POST(
      request(valid, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-JSON and malformed bodies", async () => {
    expect(
      (await POST(request(null, { "content-type": "text/plain" }, "x"))).status,
    ).toBe(415);
    expect((await POST(request(null, {}, "{not json"))).status).toBe(400);
    expect((await POST(request(null, {}, "[]"))).status).toBe(400);
    expect(
      (await POST(request(null, {}, JSON.stringify({ a: "x".repeat(9000) }))))
        .status,
    ).toBe(413);
  });

  it("rate limits repeated requests from one client", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      statuses.push((await POST(request(valid))).status);
    }
    expect(statuses.slice(0, 8).every((status) => status === 200)).toBe(true);
    expect(statuses[8]).toBe(429);
    // A different client is unaffected.
    const other = await POST(
      request(valid, { "x-nf-client-connection-ip": "198.51.100.2" }),
    );
    expect(other.status).toBe(200);
  });

  it("reports a webhook failure as 502 without leaking details", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("make.com");

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect((await POST(request(valid))).status).toBe(502);
  });
});
