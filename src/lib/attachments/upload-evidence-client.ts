import {
  EVIDENCE_BUCKET,
  validateEvidenceFile,
} from "@/lib/attachments/evidence-file-rules";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export type ClientEvidenceUploadHandlers = {
  onInitiate: (
    filename: string,
    mimeType: string,
    byteSize: number,
  ) => Promise<{ error?: string; attachmentId?: string; storagePath?: string }>;
  onConfirm: (attachmentId: string) => Promise<{ error?: string }>;
  onLink: (attachmentId: string) => Promise<{ error?: string }>;
};

export type ClientEvidenceUploadResult =
  { ok: true; attachmentId: string } | { ok: false; error: string };

export async function uploadEvidenceFileClient(
  file: File,
  handlers: ClientEvidenceUploadHandlers,
): Promise<ClientEvidenceUploadResult> {
  const validation = validateEvidenceFile(file);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const init = await handlers.onInitiate(
    validation.filename,
    validation.mimeType,
    validation.byteSize,
  );
  if (init.error || !init.attachmentId || !init.storagePath) {
    return { ok: false, error: init.error ?? "Could not start upload" };
  }

  const supabase = createBrowserSupabaseClient();
  const { error: storageError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(init.storagePath, file, { upsert: false });

  if (storageError) {
    return { ok: false, error: storageError.message };
  }

  const confirm = await handlers.onConfirm(init.attachmentId);
  if (confirm.error) {
    return { ok: false, error: confirm.error };
  }

  const link = await handlers.onLink(init.attachmentId);
  if (link.error) {
    return { ok: false, error: link.error };
  }

  return { ok: true, attachmentId: init.attachmentId };
}
