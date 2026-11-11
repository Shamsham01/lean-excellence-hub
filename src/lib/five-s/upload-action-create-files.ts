"use client";

import {
  confirmActionEvidenceUpload,
  initiateActionEvidenceUpload,
} from "@/app/(platform)/platform/actions/actions";
import { linkFiveSEvidence } from "@/app/(platform)/platform/5s/actions";
import { validateEvidenceFile } from "@/lib/attachments/evidence-file-rules";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export async function uploadFilesToFiveSAction(
  input: {
    actionId: string;
    auditId: string;
    sectionId: string;
    questionId: string;
  },
  files: File[],
): Promise<{ error?: string }> {
  for (const file of files) {
    const validation = validateEvidenceFile(file);
    if (!validation.ok) {
      return { error: validation.error };
    }

    const init = await initiateActionEvidenceUpload(
      input.actionId,
      validation.filename,
      validation.mimeType,
      validation.byteSize,
    );
    if (init.error || !init.attachmentId || !init.storagePath) {
      return { error: init.error ?? "Could not start upload" };
    }

    const supabase = createBrowserSupabaseClient();
    const { error: storageError } = await supabase.storage
      .from("organisation-evidence")
      .upload(init.storagePath, file, { upsert: false });
    if (storageError) {
      return { error: storageError.message };
    }

    const confirm = await confirmActionEvidenceUpload(
      input.actionId,
      init.attachmentId,
    );
    if (confirm.error) {
      return { error: confirm.error };
    }

    const link = await linkFiveSEvidence(
      input.auditId,
      init.attachmentId,
      input.sectionId,
      input.questionId,
    );
    if (link.error) {
      return { error: link.error };
    }
  }
  return {};
}
