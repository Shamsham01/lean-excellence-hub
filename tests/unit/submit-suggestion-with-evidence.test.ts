import { describe, expect, it, vi } from "vitest";

import {
  createSuggestionEvidenceFile,
  submitSuggestionWithEvidence,
  type SuggestionEvidenceClient,
  type SuggestionEvidenceFile,
} from "@/lib/suggestions/submit-suggestion-with-evidence";

const fields = {
  programmeVersionId: "programme-1",
  categoryId: "category-1",
  title: "Label holders",
  noticed: "Changeovers lose labels",
  proposed: "Add a holder at the station",
  benefit: "",
};

function makeFile(
  name: string,
  overrides: Partial<SuggestionEvidenceFile> = {},
): SuggestionEvidenceFile {
  const created = createSuggestionEvidenceFile(
    new File(["fixture"], name, { type: "text/plain" }),
    `client-${name}`,
  );
  if ("error" in created) {
    throw new Error(created.error);
  }
  return { ...created, ...overrides };
}

function createClient(overrides: Partial<SuggestionEvidenceClient> = {}) {
  const createDraft = vi.fn().mockResolvedValue("draft-1");
  const updateDraft = vi.fn().mockResolvedValue(undefined);
  const submit = vi.fn().mockResolvedValue(undefined);
  const initiateUpload = vi
    .fn()
    .mockImplementation(async ({ filename }: { filename: string }) => ({
      attachmentId: `att-${filename}`,
      storagePath: `org/improvement_suggestion/draft-1/${filename}`,
    }));
  const uploadObject = vi.fn().mockResolvedValue(undefined);
  const confirmUpload = vi.fn().mockResolvedValue(undefined);
  const withdrawEvidence = vi.fn().mockResolvedValue(undefined);

  const client: SuggestionEvidenceClient = {
    createDraft,
    updateDraft,
    submit,
    initiateUpload,
    uploadObject,
    confirmUpload,
    withdrawEvidence,
    ...overrides,
  };

  return {
    ...client,
    createDraft: overrides.createDraft ?? createDraft,
    updateDraft: overrides.updateDraft ?? updateDraft,
    submit: overrides.submit ?? submit,
    initiateUpload: overrides.initiateUpload ?? initiateUpload,
    uploadObject: overrides.uploadObject ?? uploadObject,
    confirmUpload: overrides.confirmUpload ?? confirmUpload,
    withdrawEvidence: overrides.withdrawEvidence ?? withdrawEvidence,
  };
}

describe("submitSuggestionWithEvidence", () => {
  it("submits without evidence", async () => {
    const client = createClient();
    const result = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: null,
      files: [],
    });

    expect(result).toEqual({
      ok: true,
      suggestionId: "draft-1",
      files: [],
    });
    expect(client.createDraft).toHaveBeenCalledTimes(1);
    expect(client.submit).toHaveBeenCalledWith("draft-1");
    expect(client.initiateUpload).not.toHaveBeenCalled();
  });

  it("retains the draft after a partial upload failure and does not submit", async () => {
    const client = createClient({
      initiateUpload: vi
        .fn()
        .mockResolvedValueOnce({
          attachmentId: "att-ok",
          storagePath: "path/ok.txt",
        })
        .mockRejectedValueOnce(new Error("storage denied")),
    });
    const result = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: null,
      files: [makeFile("ok.txt"), makeFile("fail.txt")],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draftId).toBe("draft-1");
    expect(result.blockedByFailedEvidence).toBe(true);
    expect(result.files.map((file) => file.status)).toEqual([
      "uploaded",
      "failed",
    ]);
    expect(client.submit).not.toHaveBeenCalled();
  });

  it("retries against the same draft and skips already linked files", async () => {
    const client = createClient();
    const uploaded = makeFile("ok.txt", {
      status: "uploaded",
      attachmentId: "att-ok",
      storagePath: "path/ok.txt",
      objectUploaded: true,
    });
    const failed = makeFile("retry.txt", {
      status: "failed",
      error: "previous failure",
    });

    const result = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: "draft-1",
      files: [uploaded, failed],
    });

    expect(result.ok).toBe(true);
    expect(client.createDraft).not.toHaveBeenCalled();
    expect(client.updateDraft).toHaveBeenCalledWith("draft-1", fields);
    expect(client.initiateUpload).toHaveBeenCalledTimes(1);
    expect(client.initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "retry.txt" }),
    );
    expect(client.submit).toHaveBeenCalledWith("draft-1");
  });

  it("retries confirm only when storage already succeeded", async () => {
    const client = createClient({
      confirmUpload: vi.fn().mockResolvedValue(undefined),
    });
    const pendingConfirm = makeFile("photo.jpg", {
      status: "failed",
      attachmentId: "att-photo",
      storagePath: "path/photo.jpg",
      objectUploaded: true,
      error: "confirm failed",
    });

    const result = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: "draft-1",
      files: [pendingConfirm],
    });

    expect(result.ok).toBe(true);
    expect(client.initiateUpload).not.toHaveBeenCalled();
    expect(client.uploadObject).not.toHaveBeenCalled();
    expect(client.confirmUpload).toHaveBeenCalledWith("att-photo");
  });

  it("keeps uploaded evidence and retries submit after a submission failure", async () => {
    const client = createClient({
      submit: vi
        .fn()
        .mockRejectedValueOnce(new Error("submit failed"))
        .mockResolvedValueOnce(undefined),
    });
    const first = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: null,
      files: [makeFile("note.txt")],
    });

    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.draftId).toBe("draft-1");
    expect(first.files[0]?.status).toBe("uploaded");

    const second = await submitSuggestionWithEvidence(client, {
      fields,
      draftId: first.draftId,
      files: first.files,
    });

    expect(second.ok).toBe(true);
    expect(client.createDraft).toHaveBeenCalledTimes(1);
    expect(client.initiateUpload).toHaveBeenCalledTimes(1);
    expect(client.submit).toHaveBeenCalledTimes(2);
  });
});
