import { describe, expect, it } from "vitest";

import { buildSupabaseDbQueryArgs } from "../../scripts/qa-tenant/db-cli";

describe("buildSupabaseDbQueryArgs", () => {
  it("uses deterministic --agent no with --output-format json", () => {
    const args = buildSupabaseDbQueryArgs({
      local: true,
      outputFormat: "json",
      sql: "select 1",
    });

    expect(args).toEqual([
      "supabase",
      "db",
      "query",
      "--local",
      "--output-format",
      "json",
      "--agent",
      "no",
      "select 1",
    ]);
  });

  it("preserves argument order for db-url file queries", () => {
    const args = buildSupabaseDbQueryArgs({
      databaseUrl: "postgresql://example",
      outputFormat: "json",
      filePath: "/tmp/query.sql",
    });

    expect(args).toEqual([
      "supabase",
      "db",
      "query",
      "--db-url",
      "postgresql://example",
      "--output-format",
      "json",
      "--agent",
      "no",
      "-f",
      "/tmp/query.sql",
    ]);
  });

  it("uses the local Supabase binary directly when available", () => {
    const args = buildSupabaseDbQueryArgs({
      local: true,
      outputFormat: "json",
      sql: "select 1",
    }).slice(1);

    expect(args[0]).toBe("db");
    expect(args).toContain("--local");
  });

  it("prefers --local when LEANHUB_QA_DB_LOCAL is set", () => {
    const previous = process.env.LEANHUB_QA_DB_LOCAL;
    process.env.LEANHUB_QA_DB_LOCAL = "1";

    try {
      const args = buildSupabaseDbQueryArgs({
        databaseUrl: "postgresql://example",
        outputFormat: "json",
        sql: "select 1",
      });

      expect(args).toContain("--local");
      expect(args).not.toContain("--db-url");
    } finally {
      if (previous === undefined) {
        delete process.env.LEANHUB_QA_DB_LOCAL;
      } else {
        process.env.LEANHUB_QA_DB_LOCAL = previous;
      }
    }
  });

  it("does not inject agent flag for text output", () => {
    const args = buildSupabaseDbQueryArgs({
      local: true,
      outputFormat: "text",
      sql: "select 1",
    });

    expect(args).not.toContain("--agent");
    expect(args).toContain("--output-format");
    expect(args).toContain("text");
  });
});
