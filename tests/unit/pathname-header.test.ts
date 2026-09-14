/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  createPlatformPassthroughResponse,
  PLATFORM_PATHNAME_HEADER,
} from "@/platform/http/pathname-header";

describe("platform pathname request header", () => {
  it("forwards the request path for shared loader diagnostics", () => {
    const request = new NextRequest("http://127.0.0.1:3000/platform/gemba");
    const response = createPlatformPassthroughResponse(request);

    expect(response.headers.get("x-middleware-override-headers")).toContain(
      PLATFORM_PATHNAME_HEADER,
    );
    expect(
      response.headers.get(`x-middleware-request-${PLATFORM_PATHNAME_HEADER}`),
    ).toBe("/platform/gemba");
  });
});
