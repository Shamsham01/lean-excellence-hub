import { describe, expect, it, vi, beforeEach } from "vitest";

import { uploadEvidenceFileClient } from "@/lib/attachments/upload-evidence-client";

const upload = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/platform/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload,
      }),
    },
  }),
}));

describe("uploadEvidenceFileClient", () => {
  beforeEach(() => {
    upload.mockClear();
  });

  it("uploads with the validated content type, not the browser-reported type", async () => {
    const file = new File(["hello"], "photo.jpg", { type: "" });
    const result = await uploadEvidenceFileClient(file, {
      onInitiate: async () => ({
        attachmentId: "att-1",
        storagePath: "org/att-1",
      }),
      onConfirm: async () => ({}),
      onLink: async () => ({}),
    });

    expect(result.ok).toBe(true);
    expect(upload).toHaveBeenCalledWith(
      "org/att-1",
      file,
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );
  });
});
