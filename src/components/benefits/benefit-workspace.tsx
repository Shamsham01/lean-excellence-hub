"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  getEligibleBenefitValidators,
  startBenefitRealisation,
  markBenefitRealised,
  withdrawBenefit,
} from "@/app/(platform)/platform/benefits/actions";
import { BenefitForecastPanel } from "@/components/benefits/benefit-forecast-panel";
import { BenefitHeader } from "@/components/benefits/benefit-header";
import { BenefitSubmitDialog, type BenefitValidatorEligibility } from "@/components/benefits/benefit-submit-dialog";
import { BenefitRealisationPanel } from "@/components/benefits/benefit-realisation-panel";
import { BenefitValidationPanel } from "@/components/benefits/benefit-validation-panel";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import { ResourceComments, type CommentRow } from "@/components/comments/resource-comments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatBenefitCurrencyAmount,
  formatMeasureValue,
} from "@/lib/benefits/forecast";
import { benefitStatusLabel } from "@/lib/benefits/status";
import type {
  BenefitDetail,
  BenefitForecastVersion,
  BenefitRealisationEntry,
  BenefitRealisationSummary,
  BenefitSourceLinkSummary,
} from "@/lib/benefits/types";

type BenefitWorkspaceProps = {
  detail: BenefitDetail;
  forecastHistory: BenefitForecastVersion[];
  realisationSummary: BenefitRealisationSummary | null;
  realisationEntries: BenefitRealisationEntry[];
  comments: CommentRow[];
  evidence: EvidenceItem[];
  membershipNameById: Record<string, string>;
  ownerName?: string | null;
  canManage: boolean;
  canValidateCi: boolean;
  canValidateFinance: boolean;
  canRecordRealisation: boolean;
  canValidateRealisation: boolean;
  canApproveForecast: boolean;
};

function normaliseSourceLinks(
  sourceLinks: BenefitDetail["source_links"],
): BenefitSourceLinkSummary[] {
  if (Array.isArray(sourceLinks)) return sourceLinks;
  return [];
}

export function BenefitWorkspace({
  detail,
  forecastHistory,
  realisationSummary,
  realisationEntries,
  comments,
  evidence,
  membershipNameById,
  ownerName,
  canManage,
  canValidateCi,
  canValidateFinance,
  canRecordRealisation,
  canValidateRealisation,
  canApproveForecast,
}: BenefitWorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitEligibility, setSubmitEligibility] = useState<BenefitValidatorEligibility | null>(null);
  const [submitEligibilityLoading, setSubmitEligibilityLoading] = useState(false);
  const [submitEligibilityError, setSubmitEligibilityError] = useState<string | null>(null);
  const sourceLinks = normaliseSourceLinks(detail.source_links);

  async function handleSubmitDialogOpen() {
    setSubmitDialogOpen(true);
    setSubmitEligibilityLoading(true);
    setSubmitEligibilityError(null);
    setSubmitEligibility(null);

    const result = await getEligibleBenefitValidators(detail.id);
    setSubmitEligibilityLoading(false);

    if (result.error || !result.data) {
      setSubmitEligibilityError(result.error ?? "Unable to load validator options");
      return;
    }

    setSubmitEligibility(result.data);
  }

  function handleSubmitted(submitMessage: string) {
    setMessage(submitMessage);
    router.refresh();
  }

  async function handleStartRealisation() {
    const result = await startBenefitRealisation(detail.id);
    setMessage(result.error ?? "Realisation started");
    router.refresh();
  }

  async function handleMarkRealised() {
    const result = await markBenefitRealised(detail.id);
    setMessage(result.error ?? "Benefit marked realised");
    router.refresh();
  }

  async function handleWithdraw() {
    const result = await withdrawBenefit(detail.id);
    setMessage(result.error ?? "Benefit withdrawn");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="benefit-workspace">
      <BenefitHeader
        detail={detail}
        ownerName={ownerName ?? null}
        canManage={canManage}
        canValidateCi={canValidateCi}
        canValidateFinance={canValidateFinance}
        canRecordRealisation={canRecordRealisation}
        message={message}
        onSubmit={handleSubmitDialogOpen}
        onStartRealisation={handleStartRealisation}
        onMarkRealised={handleMarkRealised}
        onWithdraw={handleWithdraw}
      />

      <BenefitSubmitDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        benefitId={detail.id}
        benefitClass={detail.benefit_class}
        eligibility={submitEligibility}
        loading={submitEligibilityLoading}
        loadError={submitEligibilityError}
        onSubmitted={handleSubmitted}
      />

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="realisation">Realisation</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Benefit definition</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div>
                <p className="font-medium">Description</p>
                <p className="text-muted-foreground">{detail.description ?? "—"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium">Baseline description</p>
                  <p className="text-muted-foreground">{detail.baseline_description ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Baseline period</p>
                  <p className="text-muted-foreground">
                    {detail.baseline_period_start && detail.baseline_period_end
                      ? `${detail.baseline_period_start} → ${detail.baseline_period_end}`
                      : "—"}
                  </p>
                </div>
              </div>
              {detail.benefit_class === "financial" ? (
                <div>
                  <p className="font-medium">Baseline financial value</p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatBenefitCurrencyAmount(
                      detail.baseline_financial_value,
                      detail.reporting_currency_snapshot,
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">Baseline measure</p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatMeasureValue(
                      detail.baseline_measure_value,
                      detail.baseline_measure_unit,
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="font-medium mb-2">Source links</p>
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
                          {link.display_label ?? link.source_resource_id}
                          <span className="text-muted-foreground">
                            {" "}
                            · {link.resource_type}
                          </span>
                        </span>
                        <Badge variant="outline">{link.relationship_role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detail.overlap_allocation ? (
                <div>
                  <p className="font-medium">Overlap allocation</p>
                  <p className="text-muted-foreground">
                    {detail.overlap_allocation.allocation_percentage}% in{" "}
                    {detail.overlap_allocation.overlap_group_name}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {detail.status_history.length === 0 ? (
                <p className="text-muted-foreground">No status changes yet.</p>
              ) : (
                detail.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:justify-between"
                  >
                    <span>
                      {benefitStatusLabel(entry.from_status)} →{" "}
                      {benefitStatusLabel(entry.to_status)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.changed_at).toLocaleString("en-GB")}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <BenefitForecastPanel
            detail={detail}
            forecastHistory={forecastHistory}
            canManage={canManage}
            canApproveForecast={canApproveForecast}
          />
        </TabsContent>

        <TabsContent value="realisation">
          <BenefitRealisationPanel
            detail={detail}
            summary={realisationSummary}
            entries={realisationEntries}
            canRecord={canRecordRealisation}
            canValidate={canValidateRealisation}
          />
        </TabsContent>

        <TabsContent value="validation">
          <BenefitValidationPanel
            detail={detail}
            membershipNameById={membershipNameById}
            canValidateCi={canValidateCi}
            canValidateFinance={canValidateFinance}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {evidence.length === 0 ? (
                <p className="text-muted-foreground">No evidence linked yet.</p>
              ) : (
                evidence.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="font-medium">{item.filename}</span>
                    <span className="text-muted-foreground">{item.mime_type}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion">
          <Card>
            <CardContent className="pt-6">
              <ResourceComments resourceId={detail.id} comments={comments} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
