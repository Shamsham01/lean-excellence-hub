import { describe, expect, it } from "vitest";

import {
  fallbackCoachEnvelope,
  parseCoachEnvelope,
} from "@/platform/ai/coach-envelope";

describe("parseCoachEnvelope", () => {
  it("keeps an in-app next step and bounded follow-ups", () => {
    const envelope = parseCoachEnvelope({
      message: "Publish a Maturity Framework.",
      next_step_label: "Open Maturity Frameworks",
      next_step_route: "/platform/maturity/models",
      permission_note: "",
      follow_up_prompts: ["What should the first version include?", ""],
    });

    expect(envelope.suggested_next_step).toEqual({
      label: "Open Maturity Frameworks",
      route: "/platform/maturity/models",
    });
    expect(envelope.follow_up_prompts).toEqual([
      "What should the first version include?",
    ]);
    expect(envelope.permission_note).toBeNull();
  });

  it("rejects external routes from untrusted model output", () => {
    const envelope = parseCoachEnvelope({
      message: "Go elsewhere.",
      next_step_label: "Leave",
      next_step_route: "https://evil.example",
      permission_note: "  ",
      follow_up_prompts: [],
    });
    expect(envelope.suggested_next_step).toBeNull();
  });

  it("falls back to a safe empty envelope", () => {
    expect(fallbackCoachEnvelope("").message).toMatch(/could not complete/i);
  });
});
