"use client";

import { useId, useMemo, useRef } from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_FILE_HELP,
  validateEvidenceFile,
} from "@/lib/attachments/evidence-file-rules";
import { isEvidenceImageMimeType } from "@/lib/attachments/evidence-preview";
import { cn } from "@/lib/utils";

export type ActionCreateEvidenceDraft = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type ActionCreateEvidencePickerProps = {
  drafts: ActionCreateEvidenceDraft[];
  onChange: (drafts: ActionCreateEvidenceDraft[]) => void;
  onPickError?: (message: string) => void;
  disabled?: boolean;
  error?: string | null;
};

function makeDraftId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function ActionCreateEvidencePicker({
  drafts,
  onChange,
  onPickError,
  disabled = false,
  error = null,
}: ActionCreateEvidencePickerProps) {
  const fileInputId = useId();
  const cameraInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const draftById = useMemo(
    () => new Map(drafts.map((draft) => [draft.id, draft])),
    [drafts],
  );

  function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    const next = [...drafts];
    const seen = new Set(next.map((draft) => draft.id));
    let validationError: string | null = null;
    for (const file of Array.from(files)) {
      const validation = validateEvidenceFile(file);
      if (!validation.ok) {
        validationError ??= validation.error;
        continue;
      }
      const id = makeDraftId(file);
      if (seen.has(id)) continue;
      seen.add(id);
      const previewUrl = isEvidenceImageMimeType(validation.mimeType)
        ? URL.createObjectURL(file)
        : null;
      next.push({ id, file, previewUrl });
    }
    if (next.length > drafts.length) {
      onChange(next);
    }
    if (validationError && next.length === drafts.length) {
      onPickError?.(validationError);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function removeDraft(id: string) {
    const draft = draftById.get(id);
    if (draft?.previewUrl) {
      URL.revokeObjectURL(draft.previewUrl);
    }
    onChange(drafts.filter((item) => item.id !== id));
  }

  return (
    <div className="flex flex-col gap-2" data-testid="action-create-evidence">
      <Label htmlFor={fileInputId}>Photos &amp; attachments</Label>
      <p className="text-xs text-muted-foreground">
        Optional. Files upload when the action is created. {EVIDENCE_FILE_HELP}.
      </p>
      {drafts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
            >
              {draft.previewUrl ? (
                <img
                  src={draft.previewUrl}
                  alt=""
                  className="size-12 rounded object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  File
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {draft.file.name}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                aria-label={`Remove ${draft.file.name}`}
                disabled={disabled}
                onClick={() => removeDraft(draft.id)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        className="sr-only"
        accept={EVIDENCE_ACCEPT}
        multiple
        disabled={disabled}
        data-testid="action-create-evidence-file"
        onChange={(event) => addFiles(event.target.files)}
      />
      <input
        ref={cameraInputRef}
        id={cameraInputId}
        type="file"
        className="sr-only"
        accept={EVIDENCE_ACCEPT}
        capture="environment"
        disabled={disabled}
        data-testid="action-create-evidence-camera"
        onChange={(event) => addFiles(event.target.files)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className={cn("min-h-11 flex-1 sm:hidden")}
          disabled={disabled}
          asChild
        >
          <label htmlFor={cameraInputId}>Take / add photo</label>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          disabled={disabled}
          asChild
        >
          <label
            htmlFor={fileInputId}
            className="inline-flex items-center gap-2"
          >
            <Upload className="size-4" aria-hidden />
            Choose file
          </label>
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
