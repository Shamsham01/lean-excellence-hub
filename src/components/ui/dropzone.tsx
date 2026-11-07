"use client";

import { Upload } from "lucide-react";
import type { DragEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Dropzone({
  title = "Drag & drop files here",
  description = "Or browse from your device. Supported formats vary by workflow.",
  onFiles,
  accept,
  disabled,
  className,
  icon,
}: {
  title?: string;
  description?: string;
  onFiles?: (files: FileList) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled || !onFiles || event.dataTransfer.files.length === 0) return;
    onFiles(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
      }}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center",
        "transition-colors duration-150 hover:border-primary/40 hover:bg-muted/30",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      data-testid="ui-dropzone"
    >
      <div
        className="grid size-14 place-items-center rounded-xl border border-dashed border-border/80 bg-card shadow-[var(--shadow-theme-xs)]"
        aria-hidden
      >
        {icon ?? <Upload className="size-6 text-muted-foreground" />}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <label className="cursor-pointer">
        <span className="sr-only">Browse files</span>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled}
          multiple
          onChange={(event) => {
            const files = event.target.files;
            if (files && onFiles) onFiles(files);
            event.target.value = "";
          }}
        />
        <span className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Browse files
        </span>
      </label>
    </div>
  );
}
