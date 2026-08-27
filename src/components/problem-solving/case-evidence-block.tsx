"use client";

import {
  confirmProblemSolvingEvidenceUpload,
  initiateProblemSolvingEvidenceUpload,
} from "@/app/(platform)/platform/problem-solving/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

type CaseEvidenceBlockProps = {
  caseId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
};

export function CaseEvidenceBlock({ caseId, evidence, canEdit }: CaseEvidenceBlockProps) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateProblemSolvingEvidenceUpload(caseId, filename, mimeType, byteSize)
      }
      onConfirm={(attachmentId) => confirmProblemSolvingEvidenceUpload(caseId, attachmentId)}
      onLink={async () => ({})}
    />
  );
}
