"use client";

import {
  confirmProjectEvidenceUpload,
  initiateProjectEvidenceUpload,
} from "@/app/(platform)/platform/projects/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

export function ProjectEvidenceBlock({
  projectId,
  evidence,
  canEdit,
}: {
  projectId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
}) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateProjectEvidenceUpload(projectId, filename, mimeType, byteSize)
      }
      onConfirm={(attachmentId) =>
        confirmProjectEvidenceUpload(projectId, attachmentId)
      }
      onLink={async () => ({})}
    />
  );
}
