import { EVIDENCE_BUCKET } from "@/lib/attachments/evidence-file-rules";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export async function downloadEvidenceObject(
  storagePath: string,
  filename: string,
): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw error ?? new Error("Unable to download evidence.");
  }

  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
