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
}: {
  actionId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
}) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
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
