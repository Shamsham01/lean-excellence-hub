"use client";

import { useMemo, useState } from "react";

import { setActionCardCover } from "@/app/(platform)/platform/actions/actions";
import { ActionEvidenceBlock } from "@/components/actions/action-evidence-block";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { Button } from "@/components/ui/button";
import { isEvidenceImageMimeType } from "@/lib/attachments/evidence-preview";

export function ActionPlannerAttachments({
  actionId,
  evidence,
  canUpload,
  canSetCover,
  coverAttachmentId,
  onMutated,
}: {
  actionId: string;
  evidence: EvidenceItem[];
  canUpload: boolean;
  canSetCover: boolean;
  coverAttachmentId: string | null;
  onMutated?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [localEvidence, setLocalEvidence] = useState<EvidenceItem[]>([]);
  const [localCoverId, setLocalCoverId] = useState<string | null>(
    coverAttachmentId,
  );

  const mergedEvidence = useMemo(() => {
    const byId = new Map<string, EvidenceItem>();
    for (const item of evidence) byId.set(item.id, item);
    for (const item of localEvidence) byId.set(item.id, item);
    return [...byId.values()];
  }, [evidence, localEvidence]);

  async function handleSetCover(attachmentId: string) {
    setPendingCover(attachmentId);
    setError(null);
    const nextCover = localCoverId === attachmentId ? null : attachmentId;
    const result = await setActionCardCover(actionId, nextCover);
    setPendingCover(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLocalCoverId(nextCover);
    onMutated?.();
  }

  const imageEvidence = mergedEvidence.filter((item) =>
    isEvidenceImageMimeType(item.mime_type),
  );

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="action-planner-attachments"
    >
      <h3 className="text-sm font-medium text-foreground">Attachments</h3>
      <ActionEvidenceBlock
        actionId={actionId}
        evidence={evidence}
        canEdit={canUpload}
        onUploadSuccess={(item) => {
          setLocalEvidence((prev) => [
            ...prev.filter((row) => row.id !== item.id),
            item,
          ]);
          onMutated?.();
        }}
      />
      {canSetCover && imageEvidence.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Card cover
          </p>
          <ul className="flex flex-col gap-2">
            {imageEvidence.map((item) => {
              const isCover = localCoverId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate text-sm">{item.filename}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isCover ? "default" : "outline"}
                    disabled={pendingCover === item.id}
                    data-testid={`action-set-cover-${item.id}`}
                    onClick={() => void handleSetCover(item.id)}
                  >
                    {isCover ? "Cover" : "Set as cover"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
