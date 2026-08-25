"use client";

import {
  confirmGembaEvidenceUpload,
  initiateGembaEvidenceUpload,
  linkGembaEvidence,
} from "@/app/(platform)/platform/gemba/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

type GembaEvidenceBlockProps = {
  walkId: string;
  sectionId: string;
  questionId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
};

export function GembaEvidenceBlock({
  walkId,
  sectionId,
  questionId,
  evidence,
  canEdit,
}: GembaEvidenceBlockProps) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      filter={(item) => item.question_id === questionId}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateGembaEvidenceUpload(walkId, filename, mimeType, byteSize)
      }
      onConfirm={confirmGembaEvidenceUpload}
      onLink={(attachmentId) =>
        linkGembaEvidence(walkId, attachmentId, sectionId, questionId)
      }
    />
  );
}
