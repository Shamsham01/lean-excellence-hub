import { describe, expect, it } from "vitest";

import {
  addToAllowlist,
  createSourceAllowlist,
  filterAllowedSourceRefs,
  sourceRefKey,
} from "@/platform/ai/source-allowlist";

describe("source allowlist", () => {
  it("filters invented source references", () => {
    const allowlist = createSourceAllowlist();
    addToAllowlist(allowlist, { hypothesis_id: "abc-123" });

    const filtered = filterAllowedSourceRefs(allowlist, [
      { label: "Hypothesis", ref: { hypothesis_id: "abc-123" } },
      { label: "Fake", ref: { hypothesis_id: "not-allowed" } },
    ]);

    expect(filtered).toHaveLength(1);
    const first = filtered[0];
    expect(first).toBeDefined();
    expect(sourceRefKey(first!.ref)).toBe("hypothesis_id:abc-123");
  });
});
