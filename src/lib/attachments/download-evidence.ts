import { EVIDENCE_BUCKET } from "@/lib/attachments/evidence-file-rules";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export async function fetchEvidenceBlob(storagePath: string): Promise<Blob> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw error ?? new Error("Unable to download evidence.");
  }

  return data;
}

export async function createEvidenceObjectUrl(
  storagePath: string,
): Promise<string> {
  const blob = await fetchEvidenceBlob(storagePath);
  return URL.createObjectURL(blob);
}

export async function downloadEvidenceObject(
  storagePath: string,
  filename: string,
): Promise<void> {
  const blob = await fetchEvidenceBlob(storagePath);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
