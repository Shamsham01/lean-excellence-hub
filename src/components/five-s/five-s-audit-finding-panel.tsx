"use client";

import { useEffect, useState } from "react";

import { ensureFiveSAuditFinding } from "@/app/(platform)/platform/5s/actions";
import {
  linkFiveSFindingToCiProject,
  unlinkFiveSFindingFromCiProject,
} from "@/app/(platform)/platform/projects/linking-actions";
import { ProjectLinkField } from "@/components/projects/project-link-field";
import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";

export type FiveSAuditFindingRow = {
  id: string;
  observation: string;
  linked_project_id: string | null;
};

type FiveSAuditFindingPanelProps = {
  auditId: string;
  sectionId: string;
  questionId: string;
  questionPrompt: string;
  finding: FiveSAuditFindingRow | null;
  linkedProject: ProjectLinkSummary | null;
  projectOptions: ProjectSelectorOption[];
  requiresSiteSelection?: boolean;
  canEdit: boolean;
  onFindingEnsured?: (finding: FiveSAuditFindingRow) => void;
};

export function FiveSAuditFindingPanel({
  auditId,
  sectionId,
  questionId,
  questionPrompt,
  finding,
  linkedProject,
  projectOptions,
  requiresSiteSelection = false,
  canEdit,
  onFindingEnsured,
}: FiveSAuditFindingPanelProps) {
  const [localFinding, setLocalFinding] = useState(finding);
  const [ensuring, setEnsuring] = useState(false);

  useEffect(() => {
    setLocalFinding(finding);
  }, [finding]);

  useEffect(() => {
    if (!canEdit || localFinding || ensuring) return;
    let cancelled = false;
    setEnsuring(true);
    void ensureFiveSAuditFinding({
      auditId,
      sectionId,
      questionId,
      observation: questionPrompt,
    }).then((result) => {
      if (cancelled) return;
      setEnsuring(false);
      if (result.id) {
        const row: FiveSAuditFindingRow = {
          id: result.id,
          observation: questionPrompt,
          linked_project_id: null,
        };
        setLocalFinding(row);
        onFindingEnsured?.(row);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    auditId,
    canEdit,
    ensuring,
    localFinding,
    onFindingEnsured,
    questionId,
    questionPrompt,
    sectionId,
  ]);

  if (!localFinding) {
    return ensuring ? (
      <p className="text-sm text-muted-foreground" data-testid="five-s-finding-ensuring">
        Preparing finding…
      </p>
    ) : null;
  }

  return (
    <div
      className="mt-4 rounded-lg border border-border bg-muted/20 p-4"
      data-testid="five-s-audit-finding-panel"
    >
      <p className="mb-2 text-sm font-medium">Audit finding</p>
      <p className="mb-3 text-sm text-muted-foreground">{localFinding.observation}</p>
      <ProjectLinkField
        label="Project link"
        linked={linkedProject}
        options={projectOptions}
        canEdit={canEdit}
        requiresSiteSelection={requiresSiteSelection}
        testId="five-s-finding-project-link"
        onLink={(projectId) =>
          linkFiveSFindingToCiProject(localFinding.id, projectId, auditId)
        }
        onUnlink={() =>
          unlinkFiveSFindingFromCiProject(localFinding.id, auditId)
        }
      />
    </div>
  );
}