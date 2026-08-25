"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

import {
  confirmEvidenceUpload,
  initiateEvidenceUpload,
  linkMaturityEvidence,
} from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type EvidenceItem = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  question_id: string | null;
};

type EvidenceUploaderProps = {
  assessmentId: string;
  criterionId: string;
  questionId?: string;
  existingEvidence: EvidenceItem[];
  canEdit: boolean;
};

type UploadState = "idle" | "uploading" | "success" | "error";

export function EvidenceUploader({
  assessmentId,
  criterionId,
  questionId,
  existingEvidence,
  canEdit,
}: EvidenceUploaderProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const filteredEvidence = existingEvidence.filter(
    (item) => item.question_id === questionId,
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!canEdit) return;
      setState("uploading");
      setError(null);

      const init = await initiateEvidenceUpload(
        assessmentId,
        file.name,
        file.type || "application/octet-stream",
        file.size,
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

      const confirm = await confirmEvidenceUpload(init.attachmentId);
      if (confirm.error) {
        setState("error");
        setError(confirm.error);
        return;
      }

      const link = await linkMaturityEvidence(
        assessmentId,
        init.attachmentId,
        criterionId,
        questionId,
      );
      if (link.error) {
        setState("error");
        setError(link.error);
        return;
      }

      setState("success");
      router.refresh();
      setTimeout(() => setState("idle"), 2000);
    },
    [assessmentId, criterionId, questionId, canEdit, router],
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

      {filteredEvidence.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {filteredEvidence.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{item.filename}</span>
              <span className="text-xs text-muted-foreground">
                {(item.byte_size / 1024).toFixed(1)} KB
              </span>
            </li>
          ))}
        </ul>
      ) : null}

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
            <p>Drag and drop a file, or select one to upload.</p>
            <p className="text-xs text-muted-foreground">
              PDF, images, or plain text up to 10 MB
            </p>
            <label className="cursor-pointer">
              <span className="sr-only">Select evidence file</span>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                onChange={(e) => onFileChange(e.target.files)}
                data-testid="evidence-file-input"
              />
              <Button type="button" size="sm" variant="outline" asChild>
                <span>Select file</span>
              </Button>
            </label>
          </div>

          {state === "uploading" ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">Uploading…</p>
          ) : null}
          {state === "success" ? (
            <p className="mt-2 text-center text-sm text-success">Evidence attached</p>
          ) : null}
          {state === "error" && error ? (
            <p className="mt-2 flex items-center justify-center gap-1 text-sm text-destructive" role="alert">
              <X className="size-4" />
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
