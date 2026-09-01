import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("supabase migration version uniqueness", () => {
  it("keeps MAT1a and N1c migration timestamps distinct", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const files = readdirSync(migrationsDir).filter((name) =>
      name.endsWith(".sql"),
    );

    const versions = files.map((name) => name.split("_")[0]);
    const duplicates = versions.filter(
      (version, index) => versions.indexOf(version) !== index,
    );

    expect(duplicates).toEqual([]);
    expect(files).toContain(
      "20260901100000_mat1a_maturity_semantic_scope_and_lifecycle.sql",
    );
    expect(files).not.toContain(
      "20260831140000_mat1a_maturity_semantic_scope_and_lifecycle.sql",
    );
    expect(files).toContain(
      "20260831130000_n1a_reliable_notification_outbox_and_delivery_ledger.sql",
    );
  });
});
