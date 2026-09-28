"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";

import { EvidenceGallery } from "@/components/attachments/evidence-gallery";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_FILE_HELP,
  validateEvidenceFile,
} from "@/lib/attachments/evidence-file-rules";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export type EvidenceItem = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  storage_object_path?: string | null;
  question_id?: string | null;
  section_id?: string | null;
  finding_id?: string | null;
  observation_id?: string | null;
  criterion_id?: string | null;
};

type EvidenceUploaderProps = {
  existingEvidence: EvidenceItem[];
  canEdit: boolean;
  filter?: (item: EvidenceItem) => boolean;
  onInitiate: (
    filename: string,
    mimeType: string,
    byteSize: number,
  ) => Promise<{ error?: string; attachmentId?: string; storagePath?: string }>;
  onConfirm: (attachmentId: string) => Promise<{ error?: string }>;
  onLink: (attachmentId: string) => Promise<{ error?: string }>;
};

type UploadState = "idle" | "uploading" | "success" | "error";

export function EvidenceUploader({
  existingEvidence,
  canEdit,
  filter,
  onInitiate,
  onConfirm,
  onLink,
}: EvidenceUploaderProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const filteredEvidence = filter
    ? existingEvidence.filter(filter)
    : existingEvidence;

  const uploadFile = useCallback(
    async (file: File) => {
      if (!canEdit) return;
      setState("uploading");
      setError(null);

      const validation = validateEvidenceFile(file);
      if (!validation.ok) {
        setState("error");
        setError(validation.error);
        return;
      }

      const init = await onInitiate(
        validation.filename,
        validation.mimeType,
        validation.byteSize,
      );
      if (init.error || !init.attachmentId || !init.storagePath) {
        setState("error");
        setError(init.error ?? "Could not start upload");
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { error: storageError } = await supabase.storage
        .from("organisation-evidence")
        .upload(init.storagePath, file, { upsert: false });

      if (storageError) {
        setState("error");
        setError(storageError.message);
        return;
      }

      const confirm = await onConfirm(init.attachmentId);
      if (confirm.error) {
        setState("error");
        setError(confirm.error);
        return;
      }

      const link = await onLink(init.attachmentId);
      if (link.error) {
        setState("error");
        setError(link.error);
        return;
      }

      setState("success");
      router.refresh();
      setTimeout(() => setState("idle"), 2000);
    },
    [canEdit, onInitiate, onConfirm, onLink, router],
  );

  function onFileChange(files: FileList | null) {
    const file = files?.[0];
    if (file) uploadFile(file);
  }

  if (!canEdit && filteredEvidence.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="evidence-uploader">
      <p className="text-sm font-medium">Evidence</p>

      <EvidenceGallery
        items={filteredEvidence}
        onError={(message) => {
          setState("error");
          setError(message);
        }}
      />

      {canEdit ? (
        <div
          className={`rounded-lg border border-dashed p-4 transition-colors ${
            dragOver ? "border-primary bg-accent/50" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFileChange(e.dataTransfer.files);
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center text-sm">
            <Upload className="size-5 text-muted-foreground" />
            <p>Drag and drop a photo or file, or select one to upload.</p>
            <p className="text-xs text-muted-foreground">
              {EVIDENCE_FILE_HELP}
            </p>
            <label className="cursor-pointer">
              <span className="sr-only">Select evidence file</span>
              <input
                type="file"
                className="hidden"
                accept={EVIDENCE_ACCEPT}
                capture="environment"
                onChange={(e) => onFileChange(e.target.files)}
                data-testid="evidence-file-input"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                asChild
              >
                <span>Select file</span>
              </Button>
            </label>
          </div>

          {state === "uploading" ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Uploading…
            </p>
          ) : null}
          {state === "success" ? (
            <p className="mt-2 text-center text-sm text-success">
              Evidence attached
            </p>
          ) : null}
          {state === "error" && error ? (
            <p
              className="mt-2 flex items-center justify-center gap-1 text-sm text-destructive"
              role="alert"
            >
              <X className="size-4" />
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
