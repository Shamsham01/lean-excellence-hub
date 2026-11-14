"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLink } from "@/components/ui/app-link";
import { closureOutcomeLabel } from "@/lib/problem-solving/closure";
import { problemSolvingSourceHref } from "@/lib/problem-solving/source";
import type {
  ProblemSolvingCaseDetail,
  ProblemSolvingSourceLinkSummary,
} from "@/lib/problem-solving/types";
import { CaseEvidenceBlock } from "@/components/problem-solving/case-evidence-block";
import { CaseDefinitionField } from "@/components/problem-solving/case-definition-field";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  updateProblemSolvingCaseDraft,
  updateProblemSolvingProblemStatement,
  updateProblemSolvingTargetCondition,
} from "@/app/(platform)/platform/problem-solving/actions";

type OverviewPanelProps = {
  detail: ProblemSolvingCaseDetail;
  evidence: EvidenceItem[];
  canContribute: boolean;
  canEditCaseDefinition: boolean;
};

function normaliseSourceLinks(
  sourceLinks: ProblemSolvingCaseDetail["source_links"],
): ProblemSolvingSourceLinkSummary[] {
  if (Array.isArray(sourceLinks)) return sourceLinks;
  return [];
}

export function OverviewPanel({
  detail,
  evidence,
  canContribute,
  canEditCaseDefinition,
}: OverviewPanelProps) {
  const sourceLinks = normaliseSourceLinks(detail.source_links);
  const caseOpen = ["draft", "active"].includes(detail.status);
  const canEditDefinition = canEditCaseDefinition && caseOpen;

  async function saveProblemStatement(nextValue: string) {
    if (detail.status === "draft") {
      return updateProblemSolvingCaseDraft({
        caseId: detail.id,
        problemStatement: nextValue,
      });
    }
    return updateProblemSolvingProblemStatement(detail.id, nextValue);
  }

  async function saveTargetCondition(nextValue: string) {
    if (detail.status === "draft") {
      return updateProblemSolvingCaseDraft({
        caseId: detail.id,
        targetCondition: nextValue,
      });
    }
    return updateProblemSolvingTargetCondition(detail.id, nextValue);
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="problem-solving-overview-panel"
    >
      <Card className="gap-4 p-4 sm:p-5">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Case definition</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-0 text-sm">
          <CaseDefinitionField
            label="Problem statement"
            value={detail.problem_statement}
            placeholder="Describe the gap between current and desired performance"
            maxLength={4000}
            testId="pps-problem-statement"
            canEdit={canEditDefinition}
            onSave={saveProblemStatement}
          />
          <div className="grid grid-cols-1 gap-3 @md/canvas:grid-cols-2">
            <div className="min-w-0">
              <p className="font-medium">Background</p>
              <p className="wrap-break-word text-muted-foreground">
                {detail.background ?? "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-medium">Business impact</p>
              <p className="wrap-break-word text-muted-foreground">
                {detail.business_impact ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 @md/canvas:grid-cols-2">
            <div>
              <p className="font-medium">Scope in</p>
              <p className="text-muted-foreground">{detail.scope_in ?? "—"}</p>
            </div>
            <div>
              <p className="font-medium">Scope out</p>
              <p className="text-muted-foreground">{detail.scope_out ?? "—"}</p>
            </div>
          </div>
          <CaseDefinitionField
            label="Target condition"
            value={detail.target_condition}
            placeholder="Describe the measurable target once the problem is solved"
            maxLength={4000}
            testId="pps-target-condition"
            canEdit={canEditDefinition}
            onSave={saveTargetCondition}
          />
          {detail.closure_outcome ? (
            <div>
              <p className="font-medium">Closure</p>
              <p className="text-muted-foreground">
                {closureOutcomeLabel(detail.closure_outcome)}
                {detail.closure_rationale
                  ? ` · ${detail.closure_rationale}`
                  : ""}
              </p>
            </div>
          ) : null}
          <div>
            <p className="mb-2 font-medium">Source links</p>
            {sourceLinks.length === 0 ? (
              <p className="text-muted-foreground">No linked sources.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sourceLinks.map((link) => {
                  const href = problemSolvingSourceHref(link);
                  const label = `${link.source_resource_id.slice(0, 8)} · ${link.resource_type}`;
                  return (
                    <div
                      key={link.source_resource_id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      {href ? (
                        <AppLink
                          href={href}
                          className="font-medium text-primary hover:underline"
                          data-testid={`problem-solving-source-link-${link.source_resource_id}`}
                        >
                          {label}
                        </AppLink>
                      ) : (
                        <span>
                          {link.source_resource_id.slice(0, 8)}
                          <span className="text-muted-foreground">
                            {" "}
                            · {link.resource_type}
                          </span>
                        </span>
                      )}
                      <Badge variant="outline">{link.link_role}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Case evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <CaseEvidenceBlock
            caseId={detail.id}
            evidence={evidence}
            canEdit={canContribute && detail.status !== "closed"}
          />
        </CardContent>
      </Card>
    </div>
  );
}