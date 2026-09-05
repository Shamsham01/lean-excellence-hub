import { redirect } from "next/navigation";

import type { EligibleOrganisation } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type IdentityState = {
  enrolment_status: string;
  identity_status: string;
  password_change_required: boolean;
};

type SessionSupabaseClient = SupabaseClient<Database>;

export async function requireClaims() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return data.claims;
}

async function readIdentityState(
  supabase: SessionSupabaseClient,
): Promise<IdentityState | null> {
  const { data, error } = await supabase.rpc("current_identity_state");
  if (error || !data?.[0]) {
    return null;
  }

  return data[0] as IdentityState;
}

export async function resolvePostAuthenticationRedirectPath(
  supabase: SessionSupabaseClient,
): Promise<string> {
  const identity = await readIdentityState(supabase);

  if (!identity || identity.identity_status !== "active") {
    return "/no-access";
  }

  if (identity.password_change_required) {
    return "/update-password";
  }

  const { data, error } = await supabase.rpc("list_my_eligible_organisations");
  if (error) {
    throw new Error("Unable to load organisation access.");
  }

  const organisations = (data ?? []) as EligibleOrganisation[];
  if (organisations.length === 0) {
    return "/no-access";
  }
  if (organisations.length === 1) {
    const switched = await supabase.rpc("switch_organisation", {
      target_organisation_id: organisations[0]!.organisation_id,
    });
    if (switched.error || switched.data !== true) {
      throw new Error("Organisation selection was not authorised.");
    }
    return "/platform";
  }

  return "/select-organisation";
}

export async function requirePlatformAccess() {
  await requireClaims();
  const supabase = await createServerSupabaseClient();
  const identity = await readIdentityState(supabase);

  if (!identity || identity.identity_status !== "active") {
    redirect("/no-access");
  }

  if (
    identity.password_change_required ||
    identity.enrolment_status === "password_change_required"
  ) {
    redirect("/update-password");
  }
}

export async function routeAfterAuthentication() {
  const supabase = await createServerSupabaseClient();
  redirect(await resolvePostAuthenticationRedirectPath(supabase));
}
