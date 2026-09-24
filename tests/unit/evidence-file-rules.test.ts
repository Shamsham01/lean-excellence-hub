import { describe, expect, it } from "vitest";

import {
  formatEvidenceFileSize,
  resolveEvidenceMimeType,
  validateEvidenceFile,
} from "@/lib/attachments/evidence-file-rules";

describe("evidence file rules", () => {
  it("accepts supported image and document types", () => {
    expect(
      validateEvidenceFile({
        name: "floor.jpg",
        size: 2048,
        type: "image/jpeg",
      }),
    ).toMatchObject({ ok: true, mimeType: "image/jpeg" });
    expect(
      validateEvidenceFile({
        name: "note.pdf",
        size: 4096,
        type: "application/pdf",
      }),
    ).toMatchObject({ ok: true, mimeType: "application/pdf" });
  });

  it("resolves a missing browser mime type from the extension", () => {
    expect(resolveEvidenceMimeType({ name: "photo.PNG", type: "" })).toBe(
      "image/png",
    );
  });

  it("rejects unsupported types and oversized files", () => {
    expect(
      validateEvidenceFile({
        name: "payload.exe",
        size: 1024,
        type: "application/x-msdownload",
      }).ok,
    ).toBe(false);
    expect(
      validateEvidenceFile({
        name: "huge.pdf",
        size: 10 * 1024 * 1024 + 1,
        type: "application/pdf",
      }).ok,
    ).toBe(false);
  });

  it("formats byte sizes for the picker", () => {
    expect(formatEvidenceFileSize(512)).toBe("512 B");
    expect(formatEvidenceFileSize(2048)).toBe("2.0 KB");
  });
});
