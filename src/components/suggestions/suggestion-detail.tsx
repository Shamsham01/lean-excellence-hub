"use client";

import Link from "next/link";
import { useState } from "react";

import {
  createProjectFromSuggestion,
  createSuggestionAction,
  markSuggestionImplemented,
} from "@/app/(platform)/platform/suggestions/actions";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { SuggestionEvidenceBlock } from "@/components/suggestions/suggestion-evidence-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  classificationSummary,
  classificationBadgeVariant,
} from "@/lib/benefits/classification";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
} from "@/lib/benefits/forecast";
import {
  benefitStatusBadgeVariant,
  benefitStatusLabel,
} from "@/lib/benefits/status";
import type { LinkedBenefitSummary } from "@/lib/benefits/types";
import { suggestionStatusLabel } from "@/lib/suggestions/status";

type StatusHistoryRow = {
  from_status: string;
  to_status: string;
  changed_at: string;
  reason: string | null;
};

type SuggestionDetailProps = {
  detail: Record<string, unknown>;
  comments: CommentRow[];
  statusHistory: StatusHistoryRow[];
  evidence: EvidenceItem[];
  benefits: LinkedBenefitSummary[];
  canManage: boolean;
  canCreateProject: boolean;
  canUploadEvidence: boolean;
};

export function SuggestionDetail({
  detail,
  comments,
  statusHistory,
  evidence,
  benefits,
  canManage,
  canCreateProject,
  canUploadEvidence,
}: SuggestionDetailProps) {
  const [message, setMessage] = useState<string | null>(null);
  const status = detail.status as string;
  const id = detail.id as string;

  async function handleAction() {
    const result = await createSuggestionAction(
      id,
      `Action: ${detail.title as string}`,
    );
    setMessage(result.error ? result.error : "Action created");
  }

  async function handleProject() {
    const result = await createProjectFromSuggestion(id);
    setMessage(
      result.error ? result.error : `Project created: ${result.id ?? ""}`,
    );
  }

  async function handleImplemented() {
    const result = await markSuggestionImplemented(
      id,
      "Improvement completed on the floor.",
    );
    setMessage(result.error ? result.error : "Marked implemented");
  }

  return (
    <div className="flex flex-col gap-6" data-testid="suggestion-detail-page">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted-foreground">
          {detail.suggestion_number as string}
        </p>
        <h1 className="typography-page-title mt-1">{detail.title as string}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{suggestionStatusLabel(status)}</Badge>
          {detail.category_name_snapshot ? (
            <Badge variant="outline">
              {detail.category_name_snapshot as string}
            </Badge>
          ) : null}
          {detail.origin_unit_name_snapshot ? (
            <span className="text-sm text-muted-foreground">
              {detail.origin_unit_name_snapshot as string}
            </span>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6 text-sm">
              <div>
                <p className="font-medium">What was noticed</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {detail.problem_or_opportunity as string}
                </p>
              </div>
              <div>
                <p className="font-medium">Proposed change</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {detail.proposed_idea as string}
                </p>
              </div>
              {detail.expected_benefit_summary ? (
                <div>
                  <p className="font-medium">Expected benefit</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {detail.expected_benefit_summary as string}
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Programme: {detail.programme_name_snapshot as string}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits">
          <Card data-testid="suggestion-benefits-panel">
            <CardHeader>
              <CardTitle>Linked benefits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {benefits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No formal benefits linked yet.
                  {detail.expected_benefit_summary ? (
                    <span className="mt-2 block text-muted-foreground">
                      Expected benefit (narrative):{" "}
                      {detail.expected_benefit_summary as string}
                    </span>
                  ) : null}
                </p>
              ) : (
                benefits.map((benefit) => (
                  <Link
                    key={benefit.id}
                    href={`/platform/benefits/${benefit.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {benefit.benefit_number
                          ? `${benefit.benefit_number} · `
                          : ""}
                        {benefit.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {classificationSummary(
                          benefit.benefit_class,
                          benefit.financial_type,
                          benefit.non_financial_type,
                        )}
                        · {benefit.relationship_role}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={classificationBadgeVariant(
                          benefit.benefit_class,
                        )}
                      >
                        {benefit.benefit_class}
                      </Badge>
                      <Badge
                        variant={benefitStatusBadgeVariant(benefit.status)}
                      >
                        {benefitStatusLabel(benefit.status)}
                      </Badge>
                      {benefit.benefit_class === "financial" ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Forecast{" "}
                          {formatBenefitCurrencyAmount(
                            benefit.forecast_total_amount,
                            null,
                          )}
                          · Validated{" "}
                          {formatBenefitCurrencyAmount(
                            benefit.validated_realised_total,
                            null,
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Target{" "}
                          {formatMeasureValue(
                            benefit.forecast_total_amount,
                            null,
                          )}
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion">
          <Card>
            <CardContent className="pt-6">
              <ResourceComments resourceId={id} comments={comments} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementation">
          <Card>
            <CardHeader>
              <CardTitle>Implementation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {detail.implementation_summary ? (
                <div>
                  <p className="font-medium">Summary</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {detail.implementation_summary as string}
                  </p>
                </div>
              ) : null}
              {canManage && ["accepted", "implementing"].includes(status) ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction()}
                  >
                    Create action
                  </Button>
                  {canCreateProject ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProject()}
                    >
                      Create project
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => handleImplemented()}>
                    Mark implemented
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {status === "implemented"
                    ? "This suggestion has been marked implemented."
                    : "Implementation actions appear once the suggestion is accepted."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionEvidenceBlock
                suggestionId={id}
                evidence={evidence}
                canEdit={canUploadEvidence}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {statusHistory.length === 0 ? (
                <p className="text-muted-foreground">No status history yet.</p>
              ) : (
                statusHistory.map((entry, index) => (
                  <div
                    key={`${entry.changed_at}-${index}`}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <span>
                      {suggestionStatusLabel(entry.from_status)} →{" "}
                      {suggestionStatusLabel(entry.to_status)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {new Date(entry.changed_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
