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

async function readIdentityState(): Promise<IdentityState | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_identity_state");
  if (error || !data?.[0]) {
    return null;
  }

  return data[0] as IdentityState;
}

export async function requirePlatformAccess() {
  await requireClaims();
  const identity = await readIdentityState();

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
  const identity = await readIdentityState();

  if (!identity || identity.identity_status !== "active") {
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
    redirect("/platform");
  }

  redirect("/select-organisation");
}
