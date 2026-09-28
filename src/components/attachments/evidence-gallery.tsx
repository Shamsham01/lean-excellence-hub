"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createEvidenceObjectUrl,
  downloadEvidenceObject,
} from "@/lib/attachments/download-evidence";
import { formatEvidenceFileSize } from "@/lib/attachments/evidence-file-rules";
import {
  evidencePreviewAltText,
  isEvidenceImageMimeType,
} from "@/lib/attachments/evidence-preview";

export type EvidenceGalleryItem = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  storage_object_path?: string | null;
};

type EvidenceGalleryProps = {
  items: EvidenceGalleryItem[];
  heading?: string;
  contextLabel?: string | null;
  onError?: (message: string) => void;
};

function revokeObjectUrl(url: string) {
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function hasAuthorisedStoragePath(item: EvidenceGalleryItem) {
  return Boolean(item.storage_object_path?.trim());
}

function EvidencePreviewCard({
  item,
  contextLabel,
  onError,
}: {
  item: EvidenceGalleryItem;
  contextLabel?: string | null;
  onError?: (message: string) => void;
}) {
  const authorisedPath = item.storage_object_path?.trim() || null;
  const canPreviewImage =
    isEvidenceImageMimeType(item.mime_type) && Boolean(authorisedPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!canPreviewImage || !authorisedPath) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void createEvidenceObjectUrl(authorisedPath)
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
        setLoadedPath(authorisedPath);
        setPreviewError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        revokeObjectUrl(objectUrl);
      }
    };
  }, [authorisedPath, canPreviewImage]);

  const openFile = useCallback(async () => {
    if (!authorisedPath) return;
    try {
      await downloadEvidenceObject(authorisedPath, item.filename);
    } catch (downloadError) {
      onError?.(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to open this evidence file.",
      );
    }
  }, [authorisedPath, item.filename, onError]);

  const altText = evidencePreviewAltText(item.filename, contextLabel);
  const showImagePreview =
    canPreviewImage &&
    Boolean(previewUrl) &&
    loadedPath === authorisedPath &&
    !previewError;

  return (
    <li
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm"
      data-testid={`evidence-item-${item.id}`}
      data-evidence-kind={showImagePreview ? "image" : "file"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {showImagePreview ? (
          <button
            type="button"
            className="w-full max-w-xs shrink-0 overflow-hidden rounded-md border border-border bg-background sm:w-40"
            onClick={() => setLightboxOpen(true)}
            aria-label={`View larger image of ${item.filename}`}
            data-testid={`evidence-preview-${item.id}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? undefined}
              alt={altText}
              className="aspect-[4/3] h-28 w-full object-cover sm:h-32"
            />
          </button>
        ) : (
          <div
            className="flex min-h-11 items-center gap-2"
            data-testid={`evidence-file-card-${item.id}`}
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <span className="min-w-0 flex-1 truncate font-medium">
            {item.filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {item.mime_type} · {formatEvidenceFileSize(item.byte_size)}
          </span>
          {authorisedPath ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => void openFile()}
              data-testid={`evidence-download-${item.id}`}
            >
              Open
            </Button>
          ) : null}
        </div>
      </div>

      {showImagePreview ? (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent
            className="max-w-[min(96vw,56rem)]"
            data-testid={`evidence-lightbox-${item.id}`}
          >
            <DialogHeader>
              <DialogTitle>{item.filename}</DialogTitle>
              <DialogDescription>
                {formatEvidenceFileSize(item.byte_size)}
              </DialogDescription>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? undefined}
              alt={altText}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void openFile()}
            >
              Open
            </Button>
          </DialogContent>
        </Dialog>
      ) : null}
    </li>
  );
}

export function EvidenceGallery({
  items,
  heading,
  contextLabel,
  onError,
}: EvidenceGalleryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-testid="evidence-gallery">
      {heading ? <p className="text-sm font-medium">{heading}</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <EvidencePreviewCard
            key={item.id}
            item={item}
            {...(contextLabel !== undefined ? { contextLabel } : {})}
            {...(onError ? { onError } : {})}
          />
        ))}
      </ul>
    </div>
  );
}

export function canAttemptEvidencePreview(item: EvidenceGalleryItem) {
  return (
    isEvidenceImageMimeType(item.mime_type) && hasAuthorisedStoragePath(item)
  );
}
