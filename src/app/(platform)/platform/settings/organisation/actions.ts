"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseMultiSiteIntent } from "@/modules/organisation-rollout/multi-site-intent";
import { currentMemberHasOrganisationScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function updateMultiSiteIntent(formData: FormData) {
  const intent = parseMultiSiteIntent(formData.get("multiSiteIntent"));
  const authorised =
    Boolean(intent) &&
    (await currentMemberHasOrganisationScopedPermission("hierarchy.manage"));

  if (!intent || !authorised) {
    redirect("/platform/settings/organisation?error=intent");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_organisation_multi_site_intent", {
    target_intent: intent,
  });

  if (error) {
    redirect("/platform/settings/organisation?error=intent");
  }

  revalidatePath("/platform/settings/organisation");
  revalidatePath("/platform/settings/organisation/rollout");
  revalidatePath("/platform/setup");
  redirect("/platform/settings/organisation");
}
