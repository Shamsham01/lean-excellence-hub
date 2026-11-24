import { expect, it } from "vitest";
import { definitionRemovalLabel } from "@/modules/operational/gemba-applicability";
it("archives definitions referenced by walks or schedules", () => {
  expect(definitionRemovalLabel(true, false)).toBe("Archive");
  expect(definitionRemovalLabel(false, true)).toBe("Archive");
  expect(definitionRemovalLabel(false, false)).toBe("Delete");
});
