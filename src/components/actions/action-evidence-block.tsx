"use client";

import {
  confirmActionEvidenceUpload,
  initiateActionEvidenceUpload,
} from "@/app/(platform)/platform/actions/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

export function ActionEvidenceBlock({
  actionId,
  evidence,
  canEdit,
  onUploadSuccess,
}: {
  actionId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
  onUploadSuccess?: (item: EvidenceItem) => void;
}) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      onUploadSuccess={onUploadSuccess}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateActionEvidenceUpload(actionId, filename, mimeType, byteSize)
      }
      onConfirm={(attachmentId) =>
        confirmActionEvidenceUpload(actionId, attachmentId)
      }
      onLink={async () => ({})}
    />
  );
}
