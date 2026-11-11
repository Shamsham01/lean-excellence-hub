"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

import { createEvidenceObjectUrl } from "@/lib/attachments/download-evidence";
import { isEvidenceImageMimeType } from "@/lib/attachments/evidence-preview";
import { cn } from "@/lib/utils";

export function ActionCardCoverThumb({
  mimeType,
  storagePath,
  alt,
  className,
}: {
  mimeType: string | null;
  storagePath: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const showImage =
    Boolean(storagePath?.trim()) && isEvidenceImageMimeType(mimeType);

  useEffect(() => {
    if (!showImage || !storagePath) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void createEvidenceObjectUrl(storagePath)
      .then((next) => {
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [showImage, storagePath]);

  if (!showImage) return null;

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- storage-backed cover preview
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn(
        "size-10 shrink-0 rounded-md object-cover ring-1 ring-border",
        className,
      )}
      data-testid="action-card-cover-thumb"
    />
  ) : (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border",
        className,
      )}
      data-testid="action-card-cover-thumb"
    >
      <ImageIcon className="size-4" aria-hidden />
    </span>
  );
}
