import { describe, expect, it } from "vitest";

import { LEANAI_FORBIDDEN_SURVEILLANCE_USES } from "@/modules/leanai-context/privacy";
import { validateLeanAiSemanticEventInput } from "@/modules/leanai-context/taxonomy";
import type { LeanAiSemanticEventInput } from "@/modules/leanai-context/types";

function validEvent(
  overrides: Partial<LeanAiSemanticEventInput> = {},
): LeanAiSemanticEventInput {
  return {
    eventKey: "module.opened",
    moduleKey: "maturity",
    metadata: {},
    ...overrides,
  };
}

describe("LeanAI semantic event taxonomy", () => {
  it("accepts bounded module.opened events", () => {
    expect(validateLeanAiSemanticEventInput(validEvent())).toEqual([]);
  });

  it("rejects unknown event keys", () => {
    const errors = validateLeanAiSemanticEventInput({
      eventKey: "dom.click" as LeanAiSemanticEventInput["eventKey"],
    });
    expect(errors.some((error) => error.field === "eventKey")).toBe(true);
  });

  it("rejects clickstream-style metadata", () => {
    const errors = validateLeanAiSemanticEventInput(
      validEvent({
        metadata: { click: "button", x: 12, y: 40 },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.message.includes("surveillance"))).toBe(
      true,
    );
  });

  it("rejects nested metadata blobs", () => {
    const errors = validateLeanAiSemanticEventInput({
      eventKey: "module.opened",
      moduleKey: "maturity",
      metadata: {
        transcript: "free text dump",
      },
    });
    expect(errors.some((error) => error.field === "metadata.transcript")).toBe(
      true,
    );
  });

  it("requires a module key for module.opened", () => {
    const errors = validateLeanAiSemanticEventInput({
      eventKey: "module.opened",
    });
    expect(errors.some((error) => error.field === "moduleKey")).toBe(true);
  });

  it("requires a bounded step_key for onboarding step events", () => {
    const errors = validateLeanAiSemanticEventInput({
      eventKey: "onboarding.step_skipped",
      metadata: {},
    });
    expect(errors.some((error) => error.field === "metadata.step_key")).toBe(
      true,
    );
  });

  it("accepts a snoozed intervention with snooze_minutes", () => {
    expect(
      validateLeanAiSemanticEventInput({
        eventKey: "leanai.intervention_snoozed",
        interventionKey: "maturity_first_setup",
        metadata: { snooze_minutes: 60 },
      }),
    ).toEqual([]);
  });

  it("does not encode employee surveillance uses", () => {
    expect(LEANAI_FORBIDDEN_SURVEILLANCE_USES).toContain(
      "employee_productivity_score",
    );
    expect(LEANAI_FORBIDDEN_SURVEILLANCE_USES).toContain(
      "disciplinary_profile",
    );
  });
});
