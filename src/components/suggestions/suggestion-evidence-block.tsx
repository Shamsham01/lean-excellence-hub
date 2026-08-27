"use client";

import {
  confirmSuggestionEvidenceUpload,
  initiateSuggestionEvidenceUpload,
} from "@/app/(platform)/platform/suggestions/actions";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/attachments/evidence-uploader";

type SuggestionEvidenceBlockProps = {
  suggestionId: string;
  evidence: EvidenceItem[];
  canEdit: boolean;
};

export function SuggestionEvidenceBlock({
  suggestionId,
  evidence,
  canEdit,
}: SuggestionEvidenceBlockProps) {
  return (
    <EvidenceUploader
      existingEvidence={evidence}
      canEdit={canEdit}
      onInitiate={(filename, mimeType, byteSize) =>
        initiateSuggestionEvidenceUpload(
          suggestionId,
          filename,
          mimeType,
          byteSize,
        )
      }
      onConfirm={(attachmentId) =>
        confirmSuggestionEvidenceUpload(suggestionId, attachmentId)
      }
      onLink={async () => ({})}
    />
  );
}
