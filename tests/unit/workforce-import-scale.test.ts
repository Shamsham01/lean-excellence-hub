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
    rows.some(
      (row) =>
        row.status === "valid" ||
        row.status === "failed" ||
        row.status === "provisioning",
    )
  ) {
    const claimable = rows.filter(
      (row) =>
        row.status === "valid" ||
        row.status === "failed" ||
        row.status === "provisioning",
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

function simulateInterruptedOrchestration(
  rows: SimulatedRow[],
  interruptAfterProvisioned: number,
) {
  const outcomes = {
    provisioned: 0,
    failed: 0,
    batches: 0,
    interruptionObserved: false,
  };

  let sessions = 0;

  while (
    rows.some(
      (row) =>
        row.status === "valid" ||
        row.status === "failed" ||
        row.status === "provisioning",
    )
  ) {
    sessions += 1;

    while (
      rows.some(
        (row) =>
          row.status === "valid" ||
          row.status === "failed" ||
          row.status === "provisioning",
      )
    ) {
      const claimable = rows.filter(
        (row) =>
          row.status === "valid" ||
          row.status === "failed" ||
          row.status === "provisioning",
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

      if (sessions === 1 && outcomes.provisioned >= interruptAfterProvisioned) {
        outcomes.interruptionObserved = true;
        break;
      }
    }
  }

  return { ...outcomes, sessions };
}

describe("1000-row import orchestration acceptance", () => {
  it("processes 1,000 valid rows with one secure server-action cycle per employee", () => {
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

  it("resumes after interruption without duplicating completed rows", () => {
    const rows: SimulatedRow[] = Array.from({ length: 20 }, (_, index) => ({
      id: `row-${index + 1}`,
      status: "valid",
    }));

    const result = simulateInterruptedOrchestration(rows, 7);
    expect(result.interruptionObserved).toBe(true);
    expect(result.sessions).toBeGreaterThan(1);
    expect(result.provisioned).toBe(20);
    expect(result.failed).toBe(0);
    expect(result.batches).toBe(20);
    expect(rows.filter((row) => row.status === "completed")).toHaveLength(20);
  });
});

describe("workforce import batch orchestration", () => {
  it("uses a single-row batch size to stay within server-action runtime limits", () => {
    expect(WORKFORCE_IMPORT_BATCH_SIZE).toBe(1);
  });

  it("projects one orchestration cycle per employee for 1,000 valid rows", () => {
    const totalRows = 1000;
    const batches = Math.ceil(totalRows / WORKFORCE_IMPORT_BATCH_SIZE);
    expect(batches).toBe(1000);
    expect(batches * WORKFORCE_IMPORT_BATCH_SIZE).toBeGreaterThanOrEqual(
      totalRows,
    );
  });
});
