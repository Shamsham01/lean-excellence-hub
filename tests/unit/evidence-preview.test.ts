import { describe, expect, it } from "vitest";

import {
  evidencePreviewAltText,
  isEvidenceImageMimeType,
} from "@/lib/attachments/evidence-preview";
import { formatFiveSAuditAnswer } from "@/components/five-s/audit-result";

describe("evidence preview helpers", () => {
  it("recognises JPEG, PNG, and WebP as image MIME types", () => {
    expect(isEvidenceImageMimeType("image/jpeg")).toBe(true);
    expect(isEvidenceImageMimeType("image/png")).toBe(true);
    expect(isEvidenceImageMimeType("image/webp")).toBe(true);
    expect(isEvidenceImageMimeType("IMAGE/WEBP")).toBe(true);
  });

  it("does not treat PDF or text as image previews", () => {
    expect(isEvidenceImageMimeType("application/pdf")).toBe(false);
    expect(isEvidenceImageMimeType("text/plain")).toBe(false);
    expect(isEvidenceImageMimeType("")).toBe(false);
  });

  it("builds accessible alt text from filename and optional context", () => {
    expect(evidencePreviewAltText("floor.webp")).toBe(
      "Evidence photo: floor.webp",
    );
    expect(evidencePreviewAltText("floor.webp", "Labels drifting")).toBe(
      "Labels drifting evidence: floor.webp",
    );
  });
});

describe("5S completed answer formatting", () => {
  it("formats yes/no, numeric, N/A, and missing answers", () => {
    expect(formatFiveSAuditAnswer("yes_no", { text_value: "yes" })).toBe("Yes");
    expect(formatFiveSAuditAnswer("yes_no", { text_value: "no" })).toBe("No");
    expect(formatFiveSAuditAnswer("score", { number_value: 4 })).toBe("4");
    expect(formatFiveSAuditAnswer("yes_no", { is_not_applicable: true })).toBe(
      "Not applicable.",
    );
    expect(formatFiveSAuditAnswer("yes_no")).toBe("No response recorded.");
  });
});
