"use client";

import {
  confirmFiveSEvidenceUpload,
  initiateFiveSEvidenceUpload,
  linkFiveSEvidence,
} from "@/app/(platform)/platform/5s/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

type FiveSEvidenceBlockProps = {
  auditId: string;
  sectionId: string;
  questionId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
};

export function FiveSEvidenceBlock({
  auditId,
  sectionId,
  questionId,
  evidence,
  canEdit,
}: FiveSEvidenceBlockProps) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      filter={(item) => item.question_id === questionId}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateFiveSEvidenceUpload(auditId, filename, mimeType, byteSize)
      }
      onConfirm={confirmFiveSEvidenceUpload}
      onLink={(attachmentId) =>
        linkFiveSEvidence(auditId, attachmentId, sectionId, questionId)
      }
    />
  );
}
