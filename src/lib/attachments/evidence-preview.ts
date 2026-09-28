const EVIDENCE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isEvidenceImageMimeType(mimeType: string | null | undefined) {
  return EVIDENCE_IMAGE_MIME_TYPES.has((mimeType ?? "").trim().toLowerCase());
}

export function evidencePreviewAltText(
  filename: string,
  contextLabel?: string | null,
) {
  const safeFilename = filename.trim() || "evidence file";
  const context = contextLabel?.trim();
  if (context) {
    return `${context} evidence: ${safeFilename}`;
  }
  return `Evidence photo: ${safeFilename}`;
}
