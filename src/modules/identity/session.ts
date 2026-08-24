import { redirect } from "next/navigation";

import {
  listEligibleOrganisations,
  switchOrganisation,
} from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type IdentityState = {
  enrolment_status: string;
  identity_status: string;
  password_change_required: boolean;
};

export async function requireClaims() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return data.claims;
}

export async function routeAfterAuthentication() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_identity_state");
  const identity = (data?.[0] ?? null) as IdentityState | null;

  if (error || !identity || identity.identity_status !== "active") {
    redirect("/no-access");
  }

  if (identity.password_change_required) {
    redirect("/update-password");
  }

  const organisations = await listEligibleOrganisations();
  if (organisations.length === 0) {
    redirect("/no-access");
  }
  if (organisations.length === 1) {
    await switchOrganisation(organisations[0]!.organisation_id);
    redirect("/");
  }

  redirect("/select-organisation");
}
