"use server";

import { revalidatePath } from "next/cache";

import { createOrganisationUnit } from "@/app/(platform)/platform/settings/structure/actions";
import { grantMemberAccess } from "@/app/(platform)/platform/people/[membershipId]/admin/actions";
import { inviteColleague } from "@/app/(platform)/platform/settings/people/actions";
import { suggestOrganisationUnitCode } from "@/modules/organisation-setup/unit-code";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import { rolloutGrantScopeError } from "@/modules/organisation-rollout/rollout-grant";
import { parseAccessScopeKey } from "@/modules/rbac2/access-scope";
import { currentMemberHasOrganisationScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function revalidateRollout() {
  revalidatePath("/platform/settings/organisation");
  revalidatePath("/platform/settings/organisation/rollout");
  revalidatePath("/platform/settings/structure");
  revalidatePath("/platform/setup");
  revalidatePath("/platform/settings/people");
}

async function siteBelongsToCurrentOrganisation(siteId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("organisation_units")
    .select("id, unit_type")
    .eq("id", siteId)
    .maybeSingle();
  return Boolean(data?.id && isSiteUnitType(data.unit_type));
}

export async function createRolloutSite(input: { name: string }) {
  const authorised =
    await currentMemberHasOrganisationScopedPermission("hierarchy.manage");
  if (!authorised) {
    return {
      error: "Ask an authorised hierarchy administrator to create the site.",
    };
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Enter the site name." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, code, name");
  const existingCodes = (units ?? []).map((unit) => unit.code);
  const code = suggestOrganisationUnitCode(name, existingCodes);
  if (!code) {
    return { error: "Enter a site name that can be used as an identifier." };
  }

  const created = await createOrganisationUnit({
    parentUnitId: null,
    code,
    name,
    unitType: "site",
  });

  if ("error" in created && created.error) {
    return created;
  }

  const { data: createdUnit } = await supabase
    .from("organisation_units")
    .select("id, name, code")
    .eq("code", code)
    .maybeSingle();

  revalidateRollout();
  return {
    ok: true as const,
    siteId: createdUnit?.id ?? null,
    siteName: createdUnit?.name ?? name,
  };
}

export async function grantRolloutSiteAccess(input: {
  membershipId: string;
  roleVersionId: string;
  scopeKey: string;
  siteId: string;
}) {
  if (!(await siteBelongsToCurrentOrganisation(input.siteId))) {
    return { error: "That site is not in this organisation." };
  }

  const scope = parseAccessScopeKey(input.scopeKey);
  const scopeError = rolloutGrantScopeError({
    siteId: input.siteId,
    scopeType: scope.scopeType,
    scopeUnitId: scope.scopeUnitId,
  });
  if (scopeError) {
    return { error: scopeError };
  }

  const result = await grantMemberAccess({
    membershipId: input.membershipId,
    roleVersionId: input.roleVersionId,
    scopeType: scope.scopeType,
    scopeUnitId: scope.scopeUnitId,
  });
  if (result.ok) {
    revalidateRollout();
  }
  return result;
}

export async function inviteRolloutSiteAccess(input: {
  email: string;
  displayName?: string;
  roleVersionId: string;
  scopeKey: string;
  siteId: string;
}) {
  if (!(await siteBelongsToCurrentOrganisation(input.siteId))) {
    return { error: "That site is not in this organisation." };
  }

  const scope = parseAccessScopeKey(input.scopeKey);
  const scopeError = rolloutGrantScopeError({
    siteId: input.siteId,
    scopeType: scope.scopeType,
    scopeUnitId: scope.scopeUnitId,
  });
  if (scopeError) {
    return { error: scopeError };
  }

  const result = await inviteColleague({
    email: input.email,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    roleVersionId: input.roleVersionId,
    scopeType: scope.scopeType,
    scopeUnitId: scope.scopeUnitId,
  });
  if ("ok" in result && result.ok) {
    revalidateRollout();
  }
  return result;
}
