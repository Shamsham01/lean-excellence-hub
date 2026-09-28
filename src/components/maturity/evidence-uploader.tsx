"use client";

import {
  confirmEvidenceUpload,
  initiateEvidenceUpload,
  linkMaturityEvidence,
} from "@/app/(platform)/platform/maturity/actions";
import {
  EvidenceUploader as SharedEvidenceUploader,
  evidenceMatchesQuestion,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

type EvidenceUploaderProps = {
  assessmentId: string;
  criterionId: string;
  questionId?: string;
  existingEvidence: EvidenceItem[];
  canEdit: boolean;
};

export function EvidenceUploader({
  assessmentId,
  criterionId,
  questionId,
  existingEvidence,
  canEdit,
}: EvidenceUploaderProps) {
  return (
    <SharedEvidenceUploader
      existingEvidence={existingEvidence}
      canEdit={canEdit}
      filter={(item) => evidenceMatchesQuestion(item, questionId, criterionId)}
      createdItemExtras={{
        criterion_id: criterionId,
        ...(questionId ? { question_id: questionId } : {}),
      }}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateEvidenceUpload(assessmentId, filename, mimeType, byteSize)
      }
      onConfirm={confirmEvidenceUpload}
      onLink={(attachmentId) =>
        linkMaturityEvidence(
          assessmentId,
          attachmentId,
          criterionId,
          questionId,
        )
      }
    />
  );
}
