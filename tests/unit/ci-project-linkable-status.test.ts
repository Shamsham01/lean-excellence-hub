import { describe, expect, it } from "vitest";

import {
  CI_PROJECT_LINKABLE_STATUSES,
  isCiProjectLinkableStatus,
} from "@/lib/projects/status";

describe("isCiProjectLinkableStatus", () => {
  it("includes live lifecycle states only", () => {
    for (const status of CI_PROJECT_LINKABLE_STATUSES) {
      expect(isCiProjectLinkableStatus(status)).toBe(true);
    }
    expect(isCiProjectLinkableStatus("completed")).toBe(false);
    expect(isCiProjectLinkableStatus("cancelled")).toBe(false);
  });
});
