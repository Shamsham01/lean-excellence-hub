/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequestError } from "@/platform/observability/request-error";

describe("request error instrumentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs route, digest, and operation without headers or cookies", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(
      new Error("Unable to load organisation access."),
      {
        digest: "abc123digest",
      },
    );

    await onRequestError(
      failure,
      {
        path: "/platform/gemba/walks/11111111-1111-1111-1111-111111111111",
        method: "POST",
        headers: {
          cookie: "sb-access-token=super-secret",
          authorization: "Bearer secret",
        },
      },
      {
        routerKind: "App Router",
        routePath: "/platform/gemba/walks/[id]",
        routeType: "action",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      },
    );

    expect(error).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(error.mock.calls[0]![1]));
    expect(payload).toMatchObject({
      category: "request",
      operation: "action",
      route: "/platform/gemba/walks/11111111-1111-1111-1111-111111111111",
      digest: "abc123digest",
      renderSource: "react-server-components",
    });
    expect(JSON.stringify(payload)).not.toMatch(/cookie|Bearer|super-secret/i);
  });

  it("ignores Next.js redirect control flow", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(
      { digest: "NEXT_REDIRECT;replace;/login" },
      { path: "/platform", method: "GET", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/platform",
        routeType: "render",
        revalidateReason: undefined,
      },
    );
    expect(error).not.toHaveBeenCalled();
  });
});
