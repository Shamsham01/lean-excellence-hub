"use server";

import { revalidatePath } from "next/cache";

import { parseMultiSiteIntent } from "@/modules/organisation-rollout/multi-site-intent";
import { currentMemberHasOrganisationScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function updateMultiSiteIntent(formData: FormData) {
  const intent = parseMultiSiteIntent(formData.get("multiSiteIntent"));
  if (!intent) {
    return { error: "Choose whether this is part of a wider organisation." };
  }

  const authorised =
    await currentMemberHasOrganisationScopedPermission("hierarchy.manage");
  if (!authorised) {
    return {
      error:
        "Ask an organisation administrator to update this organisation context.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_organisation_multi_site_intent", {
    target_intent: intent,
  });

  if (error) {
    return { error: "Unable to update organisation context." };
  }

  revalidatePath("/platform/settings/organisation");
  revalidatePath("/platform/settings/organisation/rollout");
  revalidatePath("/platform/setup");
  return { ok: true as const };
}
