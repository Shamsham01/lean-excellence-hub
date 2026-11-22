import { afterEach, describe, expect, it } from "vitest";

import { HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN } from "../../scripts/harbourfield-demo/constants";
import {
  assertHarbourfieldHostedTopUpAllowed,
  assertHarbourfieldLocalCommandAllowed,
  parseHarbourfieldDemoArgs,
} from "../../scripts/harbourfield-demo/guards";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Harbourfield demo CLI args", () => {
  it("defaults to local dry-run", () => {
    expect(parseHarbourfieldDemoArgs([])).toEqual({
      mode: "dry-run",
      target: "local",
      apply: false,
      hosted: false,
    });
  });

  it("parses apply and hosted flags", () => {
    expect(parseHarbourfieldDemoArgs(["--apply", "--hosted"])).toEqual({
      mode: "apply",
      target: "hosted",
      apply: true,
      hosted: true,
    });
  });
});

describe("Harbourfield local guards", () => {
  it("allows localhost when invoked via npm script", () => {
    process.env.npm_lifecycle_event = "demo:harbourfield:top-up:dry-run";

    expect(() =>
      assertHarbourfieldLocalCommandAllowed(
        "http://127.0.0.1:54321",
        "demo:harbourfield:top-up:dry-run",
      ),
    ).not.toThrow();
  });

  it("blocks hosted Supabase URLs for local commands", () => {
    process.env.npm_lifecycle_event = "demo:harbourfield:top-up";

    expect(() =>
      assertHarbourfieldLocalCommandAllowed(
        "https://abc123.supabase.co",
        "demo:harbourfield:top-up",
      ),
    ).toThrow(/blocked/i);
  });
});

describe("Harbourfield hosted guards", () => {
  it("refuses hosted apply without confirmation token", () => {
    delete process.env.LEANHUB_HARBOURFIELD_DEMO_CONFIRM;

    expect(() =>
      assertHarbourfieldHostedTopUpAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: "harbourfield-live-demo",
        mode: "apply",
      }),
    ).toThrow(HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN);
  });

  it("refuses wrong Supabase project ref", () => {
    expect(() =>
      assertHarbourfieldHostedTopUpAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "other-ref",
        organisationCode: "harbourfield-live-demo",
        mode: "dry-run",
      }),
    ).toThrow(/expected project ref/i);
  });

  it("refuses Apex organisation code on hosted runs", () => {
    expect(() =>
      assertHarbourfieldHostedTopUpAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: "apex-manufacturing",
        mode: "dry-run",
      }),
    ).toThrow(/not the Harbourfield demo tenant/i);
  });
});
