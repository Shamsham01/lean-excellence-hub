import { describe, expect, it } from "vitest";

import { WORKFORCE_IMPORT_BATCH_SIZE } from "@/modules/workforce-import/constants";

describe("workforce import batch orchestration", () => {
  it("uses a single-row batch size to stay within edge runtime wall-clock limits", () => {
    expect(WORKFORCE_IMPORT_BATCH_SIZE).toBe(1);
  });

  it("projects completion for 1000 valid rows", () => {
    const totalRows = 1000;
    const batches = Math.ceil(totalRows / WORKFORCE_IMPORT_BATCH_SIZE);
    expect(batches).toBe(1000);
    expect(batches * WORKFORCE_IMPORT_BATCH_SIZE).toBeGreaterThanOrEqual(
      totalRows,
    );
  });
});
