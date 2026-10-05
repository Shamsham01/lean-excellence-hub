"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createOrganisationUnit,
  updateOrganisationUnit,
} from "@/app/(platform)/platform/settings/structure/actions";
import {
  createJobFunction,
  deactivateJobFunction,
  updateJobFunction,
} from "@/app/(platform)/platform/settings/job-functions/actions";
import { recordLeanAiSemanticEvent } from "@/modules/leanai-context/queries";
import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import {
  flattenDraftUnits,
  isSkippableStructureFirstStep,
  isStructureFirstStepKey,
  suggestUniqueUnitCode,
  type StructureDraftUnit,
  type StructureFirstStepKey,
} from "@/modules/organisation-onboarding";
import { loadStructureFirstSnapshot } from "@/modules/organisation-onboarding/queries";
import { requireClaims } from "@/modules/identity/session";
import { currentMemberHasScopedPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult = { ok?: true; error?: string };

async function requireGuidedSetupOrganisation() {
  await requireClaims();
  const organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    return { error: "Organisation context is unavailable." as const };
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    return { error: "Organisation context is unavailable." as const };
  }

  const accessPath = pathForOrganisationStatus(
    current.organisation_status,
    current.onboarding_required,
  );
  if (accessPath !== "/onboarding/setup") {
    return {
      error:
        current.organisation_status === "suspended"
          ? "Suspended organisations cannot continue guided setup."
          : "Guided organisation setup is not available for this organisation.",
    };
  }

  return { organisationId, current };
}

async function recordOnboardingEvent(
  input: {
    eventKey:
      | "onboarding.started"
      | "onboarding.step_completed"
      | "onboarding.step_skipped"
      | "onboarding.completed";
    stepKey?: StructureFirstStepKey;
    extra?: Record<string, string | number | boolean | null>;
  },
  options: { required?: boolean } = {},
) {
  try {
    await recordLeanAiSemanticEvent({
      eventKey: input.eventKey,
      moduleKey: "onboarding",
      metadata: {
        ...(input.stepKey ? { step_key: input.stepKey } : {}),
        ...(input.extra ?? {}),
      },
    });
    return true;
  } catch {
    if (options.required) {
      return false;
    }
    // Pure journey telemetry is advisory. Domain mutations must still succeed.
    return true;
  }
}

function revalidateSetup() {
  revalidatePath("/onboarding/setup");
}

export async function startStructureFirstOnboarding(): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }

  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  revalidateSetup();
  return { ok: true as const };
}

export async function confirmOrganisationContext(): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }

  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  await recordOnboardingEvent({
    eventKey: "onboarding.step_completed",
    stepKey: "organisation",
  });
  await recordOnboardingEvent({
    eventKey: "onboarding.step_completed",
    stepKey: "site",
  });
  revalidateSetup();
  return { ok: true as const };
}

export async function confirmSimpleStructure(): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }

  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  const persisted = await recordOnboardingEvent(
    {
      eventKey: "onboarding.step_completed",
      stepKey: "structure",
      extra: { structure_mode: "simple" },
    },
    { required: true },
  );
  if (!persisted) {
    return {
      error: "Unable to save structure progress. Try again before continuing.",
    };
  }
  revalidateSetup();
  return { ok: true as const };
}

export async function skipStructureFirstStep(
  stepKey: string,
): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  if (
    !isStructureFirstStepKey(stepKey) ||
    !isSkippableStructureFirstStep(stepKey)
  ) {
    return { error: "This step cannot be skipped." };
  }

  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  const persisted = await recordOnboardingEvent(
    {
      eventKey: "onboarding.step_skipped",
      stepKey,
    },
    { required: true },
  );
  if (!persisted) {
    return {
      error: "Unable to save that skipped step. Try again before continuing.",
    };
  }
  revalidateSetup();
  return { ok: true as const };
}

export async function applyStructureDraft(input: {
  parentUnitId: string;
  units: StructureDraftUnit[];
}): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }

  const authorised = await currentMemberHasScopedPermission(
    "hierarchy.manage",
    input.parentUnitId,
  );
  if (!authorised) {
    return { error: "You are not authorised to create these units." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: parent } = await supabase
    .from("organisation_units")
    .select("id, code, name, unit_type, status")
    .eq("id", input.parentUnitId)
    .maybeSingle();
  if (!parent || parent.status !== "active") {
    return { error: "The selected site is not available." };
  }
  if (!isSiteUnitType(parent.unit_type)) {
    return {
      error:
        "The reviewed structure can only be applied beneath the existing site.",
    };
  }

  const flattened = flattenDraftUnits(input.units);
  if (flattened.length === 0) {
    return {
      error: "Add at least one unit, or choose Start simple to keep site only.",
    };
  }
  for (const unit of flattened) {
    if (!unit.name.trim()) {
      return { error: "Every unit needs a name before it can be saved." };
    }
    if (isSiteUnitType(unit.unitType)) {
      return {
        error:
          "This setup step adds departments, areas and teams beneath the existing site. It does not create additional sites.",
      };
    }
  }

  const { data: existingUnits } = await supabase
    .from("organisation_units")
    .select("code");
  const existingCodes = (existingUnits ?? []).map((unit) => unit.code);
  const createdIds = new Map<string, string>([
    ["__root__", input.parentUnitId],
  ]);

  for (const unit of flattened) {
    const parentId = unit.parentLocalId
      ? createdIds.get(unit.parentLocalId)
      : input.parentUnitId;
    if (!parentId) {
      return { error: "Unable to place a unit in the reviewed structure." };
    }

    const code = suggestUniqueUnitCode(unit.name, existingCodes);
    if (!code) {
      return { error: `Unable to create a code for ${unit.name}.` };
    }

    const created = await createOrganisationUnit({
      parentUnitId: parentId,
      code,
      name: unit.name.trim(),
      unitType: unit.unitType.trim() || "department",
    });
    if (created.error) {
      return { error: created.error };
    }

    existingCodes.push(code);
    const { data: createdRow } = await supabase
      .from("organisation_units")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!createdRow?.id) {
      return {
        error: `Created ${unit.name}, but could not continue the tree.`,
      };
    }
    createdIds.set(unit.localId, createdRow.id);
  }

  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  await recordOnboardingEvent({
    eventKey: "onboarding.step_completed",
    stepKey: "structure",
    extra: { structure_mode: "reviewed", unit_count: flattened.length },
  });
  revalidateSetup();
  return { ok: true as const };
}

export async function createOnboardingUnit(input: {
  parentUnitId: string | null;
  code: string;
  name: string;
  unitType: string;
}): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  if (input.parentUnitId === null) {
    return {
      error:
        "Add units beneath the existing site. This step does not create a new organisation or site.",
    };
  }
  if (isSiteUnitType(input.unitType)) {
    return {
      error:
        "Sites are billable locations already created during organisation setup. Add a department, area or team instead.",
    };
  }

  const result = await createOrganisationUnit(input);
  if (result.error) {
    return result;
  }
  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  await recordOnboardingEvent({
    eventKey: "onboarding.step_completed",
    stepKey: "structure",
  });
  revalidateSetup();
  return { ok: true as const };
}

export async function updateOnboardingUnit(input: {
  unitId: string;
  name: string;
  unitType: string;
}): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  return updateOrganisationUnit(input);
}

export async function createOnboardingJobFunction(input: {
  name: string;
  code: string;
  description?: string;
}): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  const result = await createJobFunction(input);
  if (result.error) {
    return result;
  }
  await recordOnboardingEvent({ eventKey: "onboarding.started" });
  if (result.ok) {
    await recordOnboardingEvent({
      eventKey: "onboarding.step_completed",
      stepKey: "job_functions",
    });
  }
  revalidateSetup();
  return result;
}

export async function updateOnboardingJobFunction(input: {
  jobFunctionId: string;
  name: string;
  description?: string;
}): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  return updateJobFunction(input);
}

export async function removeOnboardingJobFunction(
  jobFunctionId: string,
): Promise<ActionResult> {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    return { error: access.error };
  }
  return deactivateJobFunction(jobFunctionId);
}

export async function completeStructureFirstOnboarding() {
  const access = await requireGuidedSetupOrganisation();
  if ("error" in access) {
    redirect("/onboarding/setup?error=complete");
  }

  const snapshot = await loadStructureFirstSnapshot("readiness");
  if (!snapshot.progress.allFoundationReady) {
    redirect("/onboarding/setup?error=complete");
  }

  const supabase = await createServerSupabaseClient();
  const completed = await supabase.rpc("complete_organisation_onboarding");
  if (completed.error || completed.data !== true) {
    redirect("/onboarding/setup?error=complete");
  }

  await recordOnboardingEvent({
    eventKey: "onboarding.completed",
    extra: { foundation: true },
  });
  redirect("/platform/setup");
}
