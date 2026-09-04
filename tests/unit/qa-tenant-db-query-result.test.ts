import { describe, expect, it } from "vitest";

import {
  extractDbQueryColumn,
  parseSupabaseDbQueryRows,
  SupabaseDbQueryParseError,
} from "../../scripts/qa-tenant/db-query-result";

describe("parseSupabaseDbQueryRows", () => {
  const agentNoArray = JSON.stringify([
    { inventory: { organisation: { code: "cookieworks-manufacturing" } } },
  ]);

  const agentYesEnvelope = JSON.stringify({
    boundary: "abc123",
    rows: [
      { inventory: { organisation: { code: "cookieworks-manufacturing" } } },
    ],
    warning: "untrusted data",
  });

  it("parses --agent=no array shape (QA contract)", () => {
    const rows = parseSupabaseDbQueryRows<{
      inventory: { organisation: { code: string } };
    }>(agentNoArray, { minRows: 1, maxRows: 1 });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.inventory.organisation.code).toBe(
      "cookieworks-manufacturing",
    );
  });

  it("parses --agent=yes envelope shape (documented fallback)", () => {
    const rows = parseSupabaseDbQueryRows<{
      inventory: { organisation: { code: string } };
    }>(agentYesEnvelope, { minRows: 1 });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.inventory.organisation.code).toBe(
      "cookieworks-manufacturing",
    );
  });

  it("fails on empty stdout", () => {
    expect(() => parseSupabaseDbQueryRows("")).toThrow(
      SupabaseDbQueryParseError,
    );
    expect(() => parseSupabaseDbQueryRows("   ")).toThrow(
      "DB query returned empty stdout.",
    );
  });

  it("fails on malformed JSON", () => {
    expect(() => parseSupabaseDbQueryRows("not-json")).toThrow(
      "DB query stdout is not valid JSON",
    );
  });

  it("fails when rows key is absent (human-shell auto without normalizer fix)", () => {
    const directObject = JSON.stringify({
      organisation: null,
      counts: {},
    });

    expect(() => parseSupabaseDbQueryRows(directObject)).toThrow(
      "DB query JSON did not contain result rows",
    );
  });

  it("fails on zero rows when minRows=1", () => {
    expect(() => parseSupabaseDbQueryRows("[]", { minRows: 1 })).toThrow(
      "DB query returned 0 row(s)",
    );
  });

  it("fails when row count exceeds maxRows", () => {
    expect(() =>
      parseSupabaseDbQueryRows('[{"a":1},{"b":2}]', { maxRows: 1 }),
    ).toThrow("DB query returned 2 row(s)");
  });
});

describe("extractDbQueryColumn", () => {
  it("extracts a named column from the first row", () => {
    const stdout = JSON.stringify([
      { inventory: { counts: { memberships: 7 } } },
    ]);
    const inventory = extractDbQueryColumn<{ counts: { memberships: number } }>(
      stdout,
      "inventory",
    );

    expect(inventory.counts.memberships).toBe(7);
  });

  it("fails when column is missing", () => {
    const stdout = JSON.stringify([{ other: 1 }]);

    expect(() => extractDbQueryColumn(stdout, "inventory")).toThrow(
      'missing column "inventory"',
    );
  });
});
