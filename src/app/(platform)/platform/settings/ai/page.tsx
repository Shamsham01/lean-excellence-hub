import { notFound } from "next/navigation";

import { updateOrganisationAiSettings } from "@/app/(platform)/platform/problem-solving/ai/actions";
import { PageHeader } from "@/components/platform/page-header";
import {
  AiCreditPeriodPanel,
  type AiCreditPeriodSummary,
} from "@/components/settings/ai-credit-period-panel";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { formatAiUsageLoadError } from "@/lib/ai/usage-summary";
import { describeLeanAiCustomerInclusion } from "@/modules/billing/leanai-inclusion";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function AiSettingsPage() {
  const canManage =
    await currentMemberHasScopedPermission("ai.manage_settings");
  if (!canManage) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("organisation_ai_settings")
    .select("ai_enabled, monthly_token_ceiling, web_search_enabled")
    .maybeSingle();

  const { data: creditRows, error: creditError } = await supabase.rpc(
    "get_organisation_ai_credit_period_summary",
  );
  const creditSummary =
    creditError || !creditRows?.length
      ? null
      : (creditRows[0] as AiCreditPeriodSummary);

  const { data: usageSummary, error: usageSummaryError } = await supabase.rpc(
    "get_ai_usage_summary",
  );
  const usageLoadError = usageSummaryError
    ? formatAiUsageLoadError(usageSummaryError)
    : null;

  const { data: billingRows, error: billingError } = await supabase.rpc(
    "get_current_organisation_billing",
  );
  const billing = billingError ? null : (billingRows?.[0] ?? null);
  const inclusion = describeLeanAiCustomerInclusion(
    billingError
      ? {
          planCode: null,
          billingState: null,
          organisationStatus: null,
          billingUnavailable: true,
        }
      : {
          planCode: billing?.plan_code ?? null,
          billingState: billing?.billing_state ?? null,
          organisationStatus: billing?.organisation_status ?? null,
        },
  );

  return (
    <div className="flex flex-col gap-6" data-testid="ai-settings-page">
      <PageHeader title="LeanAI" />
      <AiCreditPeriodPanel
        summary={creditSummary}
        loadError={creditError?.message ?? null}
      />
      <AiSettingsForm
        inclusion={inclusion}
        siteQuantity={billing?.site_quantity ?? null}
        initialEnabled={settings?.ai_enabled ?? false}
        initialMonthlyTokenCeiling={settings?.monthly_token_ceiling ?? null}
        initialWebSearchEnabled={settings?.web_search_enabled ?? false}
        usageSummary={(usageSummary as Record<string, unknown> | null) ?? null}
        usageLoadError={usageLoadError}
        onSave={updateOrganisationAiSettings}
      />
    </div>
  );
}
