import {
  EVIDENCE_BUCKET,
  validateEvidenceFile,
} from "@/lib/attachments/evidence-file-rules";

export type SuggestionEvidenceFileStatus =
  "pending" | "uploading" | "uploaded" | "failed";

export type SuggestionEvidenceFile = {
  clientId: string;
  file: File;
  filename: string;
  mimeType: string;
  byteSize: number;
  status: SuggestionEvidenceFileStatus;
  attachmentId?: string;
  storagePath?: string;
  objectUploaded?: boolean;
  error?: string;
};

export type SuggestionDraftFields = {
  programmeVersionId: string;
  categoryId: string;
  title: string;
  noticed: string;
  proposed: string;
  benefit: string;
};

export type SuggestionEvidenceClient = {
  createDraft: (fields: SuggestionDraftFields) => Promise<string>;
  updateDraft: (
    suggestionId: string,
    fields: SuggestionDraftFields,
  ) => Promise<void>;
  submit: (suggestionId: string) => Promise<void>;
  initiateUpload: (input: {
    suggestionId: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) => Promise<{ attachmentId: string; storagePath: string }>;
  uploadObject: (storagePath: string, file: File) => Promise<void>;
  confirmUpload: (attachmentId: string) => Promise<void>;
  withdrawEvidence: (attachmentId: string) => Promise<void>;
};

export type SubmitSuggestionWithEvidenceInput = {
  fields: SuggestionDraftFields;
  draftId: string | null;
  files: SuggestionEvidenceFile[];
};

export type SubmitSuggestionWithEvidenceResult =
  | { ok: true; suggestionId: string; files: SuggestionEvidenceFile[] }
  | {
      ok: false;
      draftId: string | null;
      files: SuggestionEvidenceFile[];
      error: string;
      blockedByFailedEvidence: boolean;
    };

export function createSuggestionEvidenceFile(
  file: File,
  clientId = crypto.randomUUID(),
): SuggestionEvidenceFile | { error: string } {
  const validation = validateEvidenceFile(file);
  if (!validation.ok) {
    return { error: validation.error };
  }

  return {
    clientId,
    file,
    filename: validation.filename,
    mimeType: validation.mimeType,
    byteSize: validation.byteSize,
    status: "pending",
  };
}

function withFile(
  files: SuggestionEvidenceFile[],
  clientId: string,
  patch: Partial<SuggestionEvidenceFile>,
  options?: { clearError?: boolean },
): SuggestionEvidenceFile[] {
  return files.map((file) => {
    if (file.clientId !== clientId) {
      return file;
    }

    const next: SuggestionEvidenceFile = { ...file, ...patch };
    if (options?.clearError) {
      delete next.error;
    }
    return next;
  });
}

function failedEvidenceMessage(files: SuggestionEvidenceFile[]): string {
  const failed = files.filter((file) => file.status === "failed");
  if (failed.length === 0) {
    return "Unable to attach the selected evidence.";
  }

  const names = failed.map((file) => file.filename).join(", ");
  return `Some evidence could not be attached: ${names}. Retry those files or remove them before submitting.`;
}

// Interrupted uploads leave pending_upload rows until upload_expires_at.
// expire_pending_attachment_uploads is service_role-only and is not scheduled
// in-repo, so a failed storage PUT can orphan a pending object until expiry.
// Retry therefore starts a new initiate unless storage already succeeded.

export async function submitSuggestionWithEvidence(
  client: SuggestionEvidenceClient,
  input: SubmitSuggestionWithEvidenceInput,
): Promise<SubmitSuggestionWithEvidenceResult> {
  let draftId = input.draftId;
  let files = input.files.map((file) => ({ ...file }));

  try {
    if (!draftId) {
      draftId = await client.createDraft(input.fields);
    } else {
      await client.updateDraft(draftId, input.fields);
    }
  } catch (error) {
    return {
      ok: false,
      draftId,
      files,
      error:
        error instanceof Error
          ? error.message
          : "Unable to save your idea. Check your details and try again.",
      blockedByFailedEvidence: false,
    };
  }

  for (const file of files) {
    if (file.status === "uploaded" && file.attachmentId) {
      continue;
    }

    files = withFile(
      files,
      file.clientId,
      { status: "uploading" },
      { clearError: true },
    );

    try {
      let attachmentId = file.attachmentId;
      let storagePath = file.storagePath;
      let objectUploaded = file.objectUploaded === true;

      if (!attachmentId || !storagePath || !objectUploaded) {
        const initiated = await client.initiateUpload({
          suggestionId: draftId,
          filename: file.filename,
          mimeType: file.mimeType,
          byteSize: file.byteSize,
        });
        attachmentId = initiated.attachmentId;
        storagePath = initiated.storagePath;
        files = withFile(files, file.clientId, {
          attachmentId,
          storagePath,
        });
        await client.uploadObject(storagePath, file.file);
        objectUploaded = true;
        files = withFile(files, file.clientId, { objectUploaded: true });
      }

      await client.confirmUpload(attachmentId);
      files = withFile(
        files,
        file.clientId,
        {
          status: "uploaded",
          attachmentId,
          storagePath,
          objectUploaded: true,
        },
        { clearError: true },
      );
    } catch (error) {
      files = withFile(files, file.clientId, {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : `Unable to attach ${file.filename}.`,
      });
    }
  }

  if (files.some((file) => file.status === "failed")) {
    return {
      ok: false,
      draftId,
      files,
      error: failedEvidenceMessage(files),
      blockedByFailedEvidence: true,
    };
  }

  try {
    await client.submit(draftId);
  } catch (error) {
    return {
      ok: false,
      draftId,
      files,
      error:
        error instanceof Error
          ? error.message
          : "Your idea was saved, but it could not be submitted. Try again.",
      blockedByFailedEvidence: false,
    };
  }

  return { ok: true, suggestionId: draftId, files };
}

export function createBrowserSuggestionEvidenceClient(
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>,
  uploadObject: (storagePath: string, file: File) => Promise<void>,
): SuggestionEvidenceClient {
  return {
    async createDraft(fields) {
      const { data, error } = await rpc("create_suggestion_draft", {
        target_programme_version_id: fields.programmeVersionId,
        target_category_id: fields.categoryId,
        target_title: fields.title || fields.proposed.slice(0, 80),
        target_problem_or_opportunity: fields.noticed,
        target_proposed_idea: fields.proposed,
        ...(fields.benefit
          ? { target_expected_benefit_summary: fields.benefit }
          : {}),
      });
      if (error || typeof data !== "string") {
        throw error ?? new Error("Unable to save your idea.");
      }
      return data;
    },
    async updateDraft(suggestionId, fields) {
      const { error } = await rpc("update_suggestion_draft", {
        target_suggestion_id: suggestionId,
        target_title: fields.title || fields.proposed.slice(0, 80),
        target_problem_or_opportunity: fields.noticed,
        target_proposed_idea: fields.proposed,
        ...(fields.benefit
          ? { target_expected_benefit_summary: fields.benefit }
          : {}),
      });
      if (error) throw error;
    },
    async submit(suggestionId) {
      const { error } = await rpc("submit_suggestion", {
        target_suggestion_id: suggestionId,
      });
      if (error) throw error;
    },
    async initiateUpload({ suggestionId, filename, mimeType, byteSize }) {
      const { data, error } = await rpc("initiate_attachment_upload", {
        target_resource_id: suggestionId,
        target_filename: filename,
        target_mime_type: mimeType,
        target_byte_size: byteSize,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (
        !row ||
        typeof row !== "object" ||
        !("attachment_id" in row) ||
        !("storage_object_path" in row)
      ) {
        throw new Error("Unable to start the evidence upload.");
      }
      return {
        attachmentId: String(row.attachment_id),
        storagePath: String(row.storage_object_path),
      };
    },
    uploadObject,
    async confirmUpload(attachmentId) {
      const { error } = await rpc("confirm_attachment_upload", {
        target_attachment_id: attachmentId,
      });
      if (error) throw error;
    },
    async withdrawEvidence(attachmentId) {
      const { error } = await rpc("withdraw_suggestion_evidence", {
        target_attachment_id: attachmentId,
      });
      if (error) throw error;
    },
  };
}

export { EVIDENCE_BUCKET };
