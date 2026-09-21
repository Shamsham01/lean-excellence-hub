import { describe, expect, it, vi } from "vitest";

import {
  findResumableGembaWalkId,
  formatGembaWalkResumePrimaryLabel,
  formatGembaWalkResumeSecondaryLabel,
  formatGembaWalkStartedDate,
  mapActiveWalkRow,
} from "@/modules/operational/gemba-active-walks";

describe("Gemba active walk labels", () => {
  it("prefers human-readable definition names over walk ids", () => {
    expect(
      formatGembaWalkResumePrimaryLabel({
        id: "00000000-0000-0000-0000-000000000001",
        definition_name_snapshot: "Exeter production walk",
      }),
    ).toBe("Exeter production walk");
  });

  it("falls back when definition snapshot is missing", () => {
    expect(
      formatGembaWalkResumePrimaryLabel({
        id: "00000000-0000-0000-0000-000000000001",
        definition_name_snapshot: null,
      }),
    ).toBe("Gemba walk");
  });

  it("prefers human-readable unit names over raw ids", () => {
    expect(
      formatGembaWalkResumeSecondaryLabel({
        unit_name_snapshot: "Exeter · Packing",
      }),
    ).toBe("Exeter · Packing");
  });

  it("formats started dates for British locale copy", () => {
    expect(formatGembaWalkStartedDate("2026-09-20T12:00:00.000Z")).toMatch(
      /20\/09\/2026/,
    );
    expect(formatGembaWalkStartedDate(null)).toBeNull();
  });

  it("prefers live definition and unit names when snapshots are missing", () => {
    expect(
      mapActiveWalkRow({
        id: "walk-1",
        definition_name_snapshot: null,
        unit_name_snapshot: null,
        started_at: "2026-09-20T12:00:00.000Z",
        status: "in_progress",
        gemba_definition_versions: {
          gemba_definitions: { display_name: "Exeter production walk" },
        },
        organisation_units: { name: "Exeter · Packing" },
      }),
    ).toEqual({
      id: "walk-1",
      definition_name_snapshot: "Exeter production walk",
      unit_name_snapshot: "Exeter · Packing",
      started_at: "2026-09-20T12:00:00.000Z",
      status: "in_progress",
    });
  });
});

describe("findResumableGembaWalkId", () => {
  it("returns an existing in-progress walk for the same definition and unit", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "gemba_definition_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "version-1" }],
                error: null,
              }),
            }),
          };
        }

        if (table === "gemba_walks") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((column: string) => {
                if (column === "status") {
                  return {
                    eq: vi.fn().mockReturnValue({
                      in: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                          limit: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: { id: "walk-existing" },
                              error: null,
                            }),
                          }),
                        }),
                      }),
                    }),
                  };
                }

                throw new Error(`unexpected eq column ${column}`);
              }),
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    await expect(
      findResumableGembaWalkId(supabase as never, "definition-1", "unit-1"),
    ).resolves.toBe("walk-existing");
  });
});
