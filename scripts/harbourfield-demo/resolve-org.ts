import type { SupabaseClient } from "@supabase/supabase-js";

import { HARBOURFIELD_ORGANISATION_CODE } from "./constants";

export type ResolvedHarbourfieldOrganisation = {
  id: string;
  code: string;
  name: string;
};

const FORBIDDEN_ORGANISATION_CODES = new Set([
  "apex-manufacturing",
  "cookieworks-manufacturing",
  "lean-excellence-demo",
]);

export function resolveExpectedOrganisationCode() {
  return (
    process.env.LEANHUB_HARBOURFIELD_ORG_CODE ?? HARBOURFIELD_ORGANISATION_CODE
  );
}

type EligibleOrganisation = {
  organisation_id: string;
  organisation_code: string;
  organisation_name: string;
};

async function listEligibleOrganisations(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_eligible_organisations");

  if (error) {
    throw error;
  }

  return (data ?? []) as EligibleOrganisation[];
}

export function assertHarbourfieldOrganisationAllowed(
  actualCode: string,
  expectedCode: string,
) {
  if (FORBIDDEN_ORGANISATION_CODES.has(actualCode)) {
    throw new Error(
      `Harbourfield demo top-up refused: organisation code "${actualCode}" is not the Harbourfield demo tenant.`,
    );
  }

  if (actualCode !== expectedCode) {
    throw new Error(
      `Harbourfield demo top-up refused: expected organisation code "${expectedCode}", found "${actualCode}".`,
    );
  }
}

export async function resolveHarbourfieldOrganisation(
  memberClient: SupabaseClient,
  options?: { organisationId?: string | null },
): Promise<ResolvedHarbourfieldOrganisation> {
  const expectedCode = resolveExpectedOrganisationCode();
  const organisations = await listEligibleOrganisations(memberClient);

  if (options?.organisationId) {
    const organisation = organisations.find(
      (row) => row.organisation_id === options.organisationId,
    );

    if (!organisation) {
      throw new Error(
        `Harbourfield demo top-up: organisation id ${options.organisationId} is not eligible for the signed-in admin.`,
      );
    }

    assertHarbourfieldOrganisationAllowed(
      organisation.organisation_code,
      expectedCode,
    );

    return {
      id: organisation.organisation_id,
      code: organisation.organisation_code,
      name: organisation.organisation_name,
    };
  }

  const matches = organisations.filter(
    (row) => row.organisation_code === expectedCode,
  );

  if (matches.length === 0) {
    throw new Error(
      `Harbourfield demo top-up: no eligible organisation with code "${expectedCode}". On local dev, run apply once with LEANHUB_HARBOURFIELD_PROVISION_LOCAL=1 (default) to create the foundation.`,
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Harbourfield demo top-up: multiple eligible organisations matched code "${expectedCode}". Set LEANHUB_HARBOURFIELD_ORG_ID.`,
    );
  }

  const organisation = matches[0]!;
  assertHarbourfieldOrganisationAllowed(
    organisation.organisation_code,
    expectedCode,
  );

  return {
    id: organisation.organisation_id,
    code: organisation.organisation_code,
    name: organisation.organisation_name,
  };
}
