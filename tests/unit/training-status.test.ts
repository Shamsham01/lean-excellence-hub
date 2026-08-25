import { describe, expect, it } from "vitest";

import {
  deriveTrainingCompletionValidityState,
  deriveTrainingValidityDays,
  trainingMatrixCellLabel,
} from "@/lib/training/status";

describe("training validity helpers", () => {
  it("applies requirement override precedence", () => {
    expect(deriveTrainingValidityDays(365, 180)).toBe(365);
    expect(deriveTrainingValidityDays(null, 180)).toBe(180);
    expect(deriveTrainingValidityDays(null, null)).toBeNull();
  });

  it("derives expiring and expired from dates without persisted expired status", () => {
    const now = new Date("2026-08-25T12:00:00Z");
    expect(
      deriveTrainingCompletionValidityState(
        "completed",
        "2026-09-01T12:00:00Z",
        now,
      ),
    ).toBe("expiring");
    expect(
      deriveTrainingCompletionValidityState(
        "completed",
        "2026-08-20T12:00:00Z",
        now,
      ),
    ).toBe("expired");
    expect(deriveTrainingCompletionValidityState("revoked", null, now)).toBe(
      "none",
    );
  });

  it("builds accessible matrix cell labels", () => {
    expect(trainingMatrixCellLabel(false, false, "none")).toBe("Not Required");
    expect(trainingMatrixCellLabel(true, true, "valid")).toBe("Completed");
    expect(trainingMatrixCellLabel(true, false, "expired")).toBe("Expired");
  });
});
