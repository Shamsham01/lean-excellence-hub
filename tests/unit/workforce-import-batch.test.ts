import { describe, expect, it } from "vitest";

import { WORKFORCE_IMPORT_BATCH_SIZE } from "@/modules/workforce-import/constants";

describe("workforce import batch orchestration", () => {
  it("uses a 25-row batch size to avoid edge timeouts", () => {
    expect(WORKFORCE_IMPORT_BATCH_SIZE).toBe(25);
  });

  it("projects completion for 1000 valid rows", () => {
    const totalRows = 1000;
    const batches = Math.ceil(totalRows / WORKFORCE_IMPORT_BATCH_SIZE);
    expect(batches).toBe(40);
    expect(batches * WORKFORCE_IMPORT_BATCH_SIZE).toBeGreaterThanOrEqual(totalRows);
  });
});
