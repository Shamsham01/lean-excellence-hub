import { notFound } from "next/navigation";

import { updateOrganisationAiSettings } from "@/app/(platform)/platform/problem-solving/ai/actions";
import { PageHeader } from "@/components/platform/page-header";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function AiSettingsPage() {
  const canManage =
    await currentMemberHasScopedPermission("ai.manage_settings");
  if (!canManage) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("organisation_ai_settings")
    .select("ai_enabled, monthly_token_ceiling")
    .maybeSingle();

  const { data: usageSummary } = await supabase.rpc("get_ai_usage_summary");

  return (
    <div className="flex flex-col gap-6" data-testid="ai-settings-page">
      <PageHeader
        title="Lean AI settings"
        description="Enable Lean AI for your organisation and review month-to-date usage."
      />
      <AiSettingsForm
        initialEnabled={settings?.ai_enabled ?? false}
        initialMonthlyTokenCeiling={settings?.monthly_token_ceiling ?? null}
        providerAvailable={isApplicationAiProviderAvailable()}
        usageSummary={(usageSummary as Record<string, unknown> | null) ?? null}
        onSave={updateOrganisationAiSettings}
      />
    </div>
  );
}
