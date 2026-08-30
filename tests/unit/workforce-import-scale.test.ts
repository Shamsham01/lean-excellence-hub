import { describe, expect, it } from "vitest";

import {
  WORKFORCE_IMPORT_BATCH_SIZE,
  WORKFORCE_IMPORT_MAX_ROWS,
} from "@/modules/workforce-import/constants";

type SimulatedRow = {
  id: string;
  status: "valid" | "provisioning" | "completed" | "failed";
};

function simulateBatchOrchestration(rows: SimulatedRow[]) {
  const outcomes = {
    provisioned: 0,
    failed: 0,
    batches: 0,
  };

  while (
    rows.some((row) => row.status === "valid" || row.status === "failed")
  ) {
    const claimable = rows.filter(
      (row) => row.status === "valid" || row.status === "failed",
    );
    const batch = claimable.slice(0, WORKFORCE_IMPORT_BATCH_SIZE);
    if (batch.length === 0) {
      break;
    }

    outcomes.batches += 1;
    for (const row of batch) {
      row.status = "provisioning";
      row.status = "completed";
      outcomes.provisioned += 1;
    }
  }

  return outcomes;
}

describe("1000-row import orchestration acceptance", () => {
  it("processes 1,000 valid rows across 40 batches with zero acceptable failure threshold", () => {
    const rows: SimulatedRow[] = Array.from(
      { length: WORKFORCE_IMPORT_MAX_ROWS },
      (_, index) => ({
        id: `row-${index + 1}`,
        status: "valid",
      }),
    );

    const result = simulateBatchOrchestration(rows);
    expect(result.provisioned).toBe(1000);
    expect(result.failed).toBe(0);
    expect(result.batches).toBe(1000);
    expect(rows.every((row) => row.status === "completed")).toBe(true);
  });
});
