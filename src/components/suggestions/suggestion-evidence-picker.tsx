"use client";

import { FileText, Upload, X } from "lucide-react";

import {
  EVIDENCE_ACCEPT,
  EVIDENCE_FILE_HELP,
  formatEvidenceFileSize,
} from "@/lib/attachments/evidence-file-rules";
import type { SuggestionEvidenceFile } from "@/lib/suggestions/submit-suggestion-with-evidence";
import { Button } from "@/components/ui/button";

type SuggestionEvidencePickerProps = {
  files: SuggestionEvidenceFile[];
  disabled?: boolean;
  onAddFiles: (files: FileList | null) => void;
  onRemove: (clientId: string) => void;
  onRetry: (clientId: string) => void;
};

function statusLabel(file: SuggestionEvidenceFile): string {
  if (file.status === "uploaded") return "Attached";
  if (file.status === "uploading") return "Uploading…";
  if (file.status === "failed") return file.error ?? "Failed";
  return "Ready";
}

export function SuggestionEvidencePicker({
  files,
  disabled = false,
  onAddFiles,
  onRemove,
  onRetry,
}: SuggestionEvidencePickerProps) {
  return (
    <div
      className="flex flex-col gap-3"
      data-testid="suggestion-evidence-picker"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Evidence (optional)</span>
        <p className="text-xs text-muted-foreground">{EVIDENCE_FILE_HELP}</p>
      </div>

      {files.length > 0 ? (
        <ul
          className="flex flex-col gap-2"
          data-testid="suggestion-evidence-list"
        >
          {files.map((file) => (
            <li
              key={file.clientId}
              className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center"
              data-testid={`suggestion-evidence-item-${file.clientId}`}
              data-status={file.status}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatEvidenceFileSize(file.byteSize)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    file.status === "failed"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                  data-testid={`suggestion-evidence-status-${file.clientId}`}
                >
                  {statusLabel(file)}
                </span>
                {file.status === "failed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={disabled}
                    onClick={() => onRetry(file.clientId)}
                    data-testid={`suggestion-evidence-retry-${file.clientId}`}
                  >
                    Retry
                  </Button>
                ) : null}
                {file.status !== "uploading" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    disabled={disabled}
                    onClick={() => onRemove(file.clientId)}
                    data-testid={`suggestion-evidence-remove-${file.clientId}`}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center text-sm">
        <Upload className="size-5 text-muted-foreground" />
        <span>Add photos or files</span>
        <span className="sr-only">Select evidence files</span>
        <input
          type="file"
          className="hidden"
          accept={EVIDENCE_ACCEPT}
          multiple
          disabled={disabled}
          onChange={(event) => {
            onAddFiles(event.target.files);
            event.target.value = "";
          }}
          data-testid="suggestion-evidence-file-input"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          asChild
        >
          <span>Select files</span>
        </Button>
      </label>
    </div>
  );
}

export function SuggestionEvidenceValidationAlert({
  messages,
}: {
  messages: string[];
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-1 text-sm text-destructive"
      role="alert"
      data-testid="suggestion-evidence-validation"
    >
      {messages.map((message) => (
        <p key={message} className="flex items-start gap-1">
          <X className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </p>
      ))}
    </div>
  );
}
