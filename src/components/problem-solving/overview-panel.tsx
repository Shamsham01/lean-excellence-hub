import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { closureOutcomeLabel } from "@/lib/problem-solving/closure";
import type {
  ProblemSolvingCaseDetail,
  ProblemSolvingSourceLinkSummary,
} from "@/lib/problem-solving/types";
import { CaseEvidenceBlock } from "@/components/problem-solving/case-evidence-block";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";

type OverviewPanelProps = {
  detail: ProblemSolvingCaseDetail;
  evidence: EvidenceItem[];
  canContribute: boolean;
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
}: OverviewPanelProps) {
  const sourceLinks = normaliseSourceLinks(detail.source_links);

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-overview-panel"
    >
      <Card>
        <CardHeader>
          <CardTitle>Case definition</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="font-medium">Problem statement</p>
            <p className="text-muted-foreground">
              {detail.problem_statement ?? "—"}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium">Background</p>
              <p className="text-muted-foreground">
                {detail.background ?? "—"}
              </p>
            </div>
            <div>
              <p className="font-medium">Business impact</p>
              <p className="text-muted-foreground">
                {detail.business_impact ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium">Scope in</p>
              <p className="text-muted-foreground">{detail.scope_in ?? "—"}</p>
            </div>
            <div>
              <p className="font-medium">Scope out</p>
              <p className="text-muted-foreground">{detail.scope_out ?? "—"}</p>
            </div>
          </div>
          <div>
            <p className="font-medium">Target condition</p>
            <p className="text-muted-foreground">
              {detail.target_condition ?? "—"}
            </p>
          </div>
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
                {sourceLinks.map((link) => (
                  <div
                    key={link.source_resource_id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span>
                      {link.source_resource_id.slice(0, 8)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {link.resource_type}
                      </span>
                    </span>
                    <Badge variant="outline">{link.link_role}</Badge>
                  </div>
                ))}
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
