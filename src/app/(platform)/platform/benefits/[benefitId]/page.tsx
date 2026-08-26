import Link from "next/link";
import { notFound } from "next/navigation";

import { BenefitWorkspace } from "@/components/benefits/benefit-workspace";
import { callBenefitRpc, untypedFrom } from "@/lib/benefits/supabase-untyped";
import type {
  BenefitDetail,
  BenefitForecastVersion,
  BenefitRealisationEntry,
  BenefitRealisationSummary,
} from "@/lib/benefits/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function BenefitDetailPage({
  params,
}: {
  params: Promise<{ benefitId: string }>;
}) {
  const { benefitId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: detail, error } = await callBenefitRpc<BenefitDetail>(
    supabase,
    "get_benefit_detail",
    { target_benefit_id: benefitId },
  );

  if (error || !detail) notFound();

  const canManage = await currentMemberHasPermission("benefits.manage");
  const canValidateCi = await currentMemberHasPermission("benefits.validate.ci");
  const canValidateFinance = await currentMemberHasPermission("benefits.validate.finance");
  const canRecordRealisation = await currentMemberHasPermission("benefits.realisation.record");
  const canValidateRealisation = await currentMemberHasPermission("benefits.realisation.validate");

  const { data: forecastHistoryData } = await callBenefitRpc<{ items: BenefitForecastVersion[] }>(
    supabase,
    "get_benefit_forecast_history",
    { target_benefit_id: benefitId },
  );

  const { data: realisationHistoryData } = await callBenefitRpc<{ items: BenefitRealisationEntry[] }>(
    supabase,
    "get_benefit_realisation_history",
    { target_benefit_id: benefitId },
  );

  const { data: realisationSummary } = await callBenefitRpc<BenefitRealisationSummary>(
    supabase,
    "get_benefit_realisation_summary",
    { target_benefit_id: benefitId },
  );

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_membership_id")
    .eq("target_resource_id", benefitId)
    .order("created_at");

  const { data: evidenceLinks } = await untypedFrom(supabase, "benefit_evidence_links")
    .select("attachment_id")
    .eq("benefit_id", benefitId);

  const attachmentIds =
    (evidenceLinks as Array<{ attachment_id: string }> | null)?.map((row) => row.attachment_id) ??
    [];

  let evidence: Array<{
    id: string;
    filename: string;
    mime_type: string;
    byte_size: number;
  }> = [];

  if (attachmentIds.length > 0) {
    const { data: attachmentRows } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size")
      .in("id", attachmentIds);
    evidence =
      attachmentRows
        ?.filter((row) => row.byte_size != null)
        .map((row) => ({
          id: row.id,
          filename: row.filename,
          mime_type: row.mime_type,
          byte_size: row.byte_size as number,
        })) ?? [];
  }

  const membershipIds = [
    ...new Set([
      detail.owner_membership_id,
      detail.created_by_membership_id,
      ...detail.status_history.map((entry) => entry.changed_by_membership_id),
      ...detail.validation_assignments.map((row) => row.validator_membership_id),
      ...detail.validations.map((row) => row.validator_membership_id),
      ...realisationHistoryData?.items?.map((row) => row.recorded_by_membership_id) ?? [],
    ]),
  ];

  const membershipNameById: Record<string, string> = {};
  if (membershipIds.length > 0) {
    const { data: membershipRows } = await supabase
      .from("organisation_memberships")
      .select("id, display_name")
      .in("id", membershipIds);
    for (const row of membershipRows ?? []) {
      membershipNameById[row.id] = row.display_name ?? row.id.slice(0, 8);
    }
  }

  return (
    <div data-testid="benefit-detail-page">
      <BenefitWorkspace
        detail={detail}
        forecastHistory={forecastHistoryData?.items ?? []}
        realisationSummary={realisationSummary}
        realisationEntries={realisationHistoryData?.items ?? []}
        comments={comments ?? []}
        evidence={evidence}
        membershipNameById={membershipNameById}
        ownerName={membershipNameById[detail.owner_membership_id] ?? null}
        canManage={canManage}
        canValidateCi={canValidateCi}
        canValidateFinance={canValidateFinance}
        canRecordRealisation={canRecordRealisation}
        canValidateRealisation={canValidateRealisation}
        canApproveForecast={canValidateFinance || canManage}
      />
      <Link
        href="/platform/benefits"
        className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        Back to benefits
      </Link>
    </div>
  );
}
