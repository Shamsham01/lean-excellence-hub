export const EVIDENCE_BUCKET = "organisation-evidence";

export const EVIDENCE_MAX_BYTE_SIZE = 10 * 1024 * 1024;

export const EVIDENCE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;

export const EVIDENCE_ACCEPT = EVIDENCE_ALLOWED_MIME_TYPES.join(",");

export const EVIDENCE_FILE_HELP =
  "PDF, JPEG, PNG, WebP, or plain text up to 10 MB";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

export type EvidenceFileValidation =
  | { ok: true; filename: string; mimeType: string; byteSize: number }
  | { ok: false; error: string };

export function formatEvidenceFileSize(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  return `${(byteSize / 1024).toFixed(1)} KB`;
}

export function resolveEvidenceMimeType(file: {
  name: string;
  type?: string;
}): string {
  const reported = file.type?.trim().toLowerCase() ?? "";
  if ((EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(reported)) {
    return reported;
  }

  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";
  return MIME_BY_EXTENSION[extension] ?? reported;
}

export function validateEvidenceFile(file: {
  name: string;
  size: number;
  type?: string;
}): EvidenceFileValidation {
  const filename = file.name.trim();
  if (!filename) {
    return { ok: false, error: "Choose a file with a name." };
  }

  if (file.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > EVIDENCE_MAX_BYTE_SIZE) {
    return {
      ok: false,
      error: `${filename} is larger than the 10 MB limit.`,
    };
  }

  const mimeType = resolveEvidenceMimeType(file);
  if (!(EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return {
      ok: false,
      error: `${filename} is not a supported evidence type. ${EVIDENCE_FILE_HELP}.`,
    };
  }

  return {
    ok: true,
    filename,
    mimeType,
    byteSize: file.size,
  };
}
