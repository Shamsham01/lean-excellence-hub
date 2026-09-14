import { cache } from "react";
import { redirect } from "next/navigation";

import { listEligibleOrganisations } from "@/modules/organisations/context";
import {
  createPlatformBoundaryReference,
  isNextNavigationError,
  logPlatformBoundaryError,
  throwPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";
import { readRequestPathname } from "@/platform/http/request-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type IdentityState = {
  enrolment_status: string;
  identity_status: string;
  password_change_required: boolean;
};

type SessionSupabaseClient = SupabaseClient<Database>;

export const requireClaims = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      if (error) {
        logPlatformBoundaryError({
          category: "auth",
          operation: "getClaims",
          reference: createPlatformBoundaryReference(),
          route: await readRequestPathname(),
          supabaseCode: error.code ?? null,
          supabaseMessage: error.message,
        });
      }
      redirect("/login");
    }

    return data.claims;
  } catch (cause) {
    if (isNextNavigationError(cause)) {
      throw cause;
    }

    throwPlatformBoundaryError({
      category: "auth",
      operation: "getClaims",
      route: await readRequestPathname(),
      cause,
    });
  }
});

const readIdentityState = cache(async (): Promise<IdentityState | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_identity_state");
  if (error) {
    throwPlatformBoundaryError({
      category: "identity",
      operation: "current_identity_state",
      route: await readRequestPathname(),
      supabaseError: error,
    });
  }

  if (!data?.[0]) {
    return null;
  }

  return data[0] as IdentityState;
});

export async function resolvePostAuthenticationRedirectPath(
  supabase: SessionSupabaseClient,
): Promise<string> {
  const identity = await readIdentityState();

  if (!identity || identity.identity_status !== "active") {
    return "/no-access";
  }

  if (identity.password_change_required) {
    return "/update-password";
  }

  const organisations = await listEligibleOrganisations();
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

export const requirePlatformAccess = cache(async () => {
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
});

export async function routeAfterAuthentication() {
  const supabase = await createServerSupabaseClient();
  redirect(await resolvePostAuthenticationRedirectPath(supabase));
}
