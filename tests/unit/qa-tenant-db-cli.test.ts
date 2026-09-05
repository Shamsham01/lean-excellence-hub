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
