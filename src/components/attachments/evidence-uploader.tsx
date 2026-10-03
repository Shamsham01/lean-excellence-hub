"use client";

import { useCallback, useId, useState } from "react";
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

type EvidenceAssociation = Pick<
  EvidenceItem,
  | "question_id"
  | "section_id"
  | "finding_id"
  | "observation_id"
  | "criterion_id"
>;

type EvidenceUploaderProps = {
  existingEvidence: EvidenceItem[];
  canEdit: boolean;
  filter?: (item: EvidenceItem) => boolean;
  createdItemExtras?: EvidenceAssociation;
  onInitiate: (
    filename: string,
    mimeType: string,
    byteSize: number,
  ) => Promise<{ error?: string; attachmentId?: string; storagePath?: string }>;
  onConfirm: (attachmentId: string) => Promise<{ error?: string }>;
  onLink: (attachmentId: string) => Promise<{ error?: string }>;
};

export function evidenceMatchesQuestion(
  item: EvidenceItem,
  questionId: string | undefined,
  criterionId?: string,
) {
  if (questionId && item.question_id) {
    return item.question_id === questionId;
  }
  if (criterionId && !item.question_id) {
    return item.criterion_id === criterionId;
  }
  return Boolean(questionId) && item.question_id === questionId;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function EvidenceUploader({
  existingEvidence,
  canEdit,
  filter,
  createdItemExtras,
  onInitiate,
  onConfirm,
  onLink,
}: EvidenceUploaderProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState<EvidenceItem[]>([]);
  const fileInputId = useId();

  const filteredEvidence = filter
    ? existingEvidence.filter(filter)
    : existingEvidence;
  const visibleEvidence = [
    ...filteredEvidence,
    ...pendingEvidence.filter(
      (item) => !filteredEvidence.some((existing) => existing.id === item.id),
    ),
  ];

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

      const attachmentId = init.attachmentId;
      const storagePath = init.storagePath;
      const pendingItem: EvidenceItem = {
        id: attachmentId,
        filename: validation.filename,
        mime_type: validation.mimeType,
        byte_size: validation.byteSize,
        storage_object_path: storagePath,
      };
      if (createdItemExtras?.question_id !== undefined) {
        pendingItem.question_id = createdItemExtras.question_id;
      }
      if (createdItemExtras?.section_id !== undefined) {
        pendingItem.section_id = createdItemExtras.section_id;
      }
      if (createdItemExtras?.finding_id !== undefined) {
        pendingItem.finding_id = createdItemExtras.finding_id;
      }
      if (createdItemExtras?.observation_id !== undefined) {
        pendingItem.observation_id = createdItemExtras.observation_id;
      }
      if (createdItemExtras?.criterion_id !== undefined) {
        pendingItem.criterion_id = createdItemExtras.criterion_id;
      }

      setPendingEvidence((current) => [
        ...current.filter((item) => item.id !== attachmentId),
        pendingItem,
      ]);
      setState("success");
      // Do not router.refresh() here. Delayed refreshes collide with answer
      // saves (5S evidence race), and maturity evidence linking no longer
      // revalidates the assessment RSC tree after photo upload.
      setTimeout(() => setState("idle"), 2000);
    },
    [canEdit, createdItemExtras, onInitiate, onConfirm, onLink],
  );

  function onFileChange(files: FileList | null) {
    const file = files?.[0];
    if (file) uploadFile(file);
  }

  if (!canEdit && visibleEvidence.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="evidence-uploader">
      <p className="text-sm font-medium">Evidence</p>

      <EvidenceGallery
        items={visibleEvidence}
        onError={(message) => {
          setState("error");
          setError(message);
        }}
      />

      {canEdit ? (
        <>
          <input
            id={fileInputId}
            type="file"
            className="sr-only"
            accept={EVIDENCE_ACCEPT}
            onChange={(e) => onFileChange(e.target.files)}
            data-testid="evidence-file-input"
          />
          <div className="flex flex-col gap-2 sm:hidden">
            <label className="cursor-pointer">
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => onFileChange(e.target.files)}
                data-testid="evidence-camera-input"
              />
              <Button type="button" className="min-h-11 w-full" asChild>
                <span>Take / add photo</span>
              </Button>
            </label>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              asChild
            >
              <label htmlFor={fileInputId}>Choose file</label>
            </Button>
            <p className="text-xs text-muted-foreground">
              {EVIDENCE_FILE_HELP}
            </p>
          </div>
          <div
            className={`hidden rounded-lg border border-dashed p-4 transition-colors sm:block ${
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                asChild
              >
                <label htmlFor={fileInputId}>Select file</label>
              </Button>
            </div>
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
        </>
      ) : null}
    </div>
  );
}
