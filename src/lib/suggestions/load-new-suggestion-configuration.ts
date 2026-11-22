import type { SupabaseClient } from "@supabase/supabase-js";

import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

type SubmissionConfiguration = {
  programmes: Array<{
    programme_version_id: string;
    programme_name: string;
    submission_guidance: string | null;
  }>;
  categories: Array<{
    category_id: string;
    category_name: string;
  }>;
};

export type NewSuggestionFormConfiguration = {
  loadError: string | null;
  programmesForForm: Array<{ id: string; programme_name: string }>;
  categoriesForForm: Array<{ id: string; name: string }>;
  primaryUnit: {
    hasPrimaryUnit: boolean;
    canManageAssignment: boolean;
    membershipId?: string;
    unitName?: string;
  };
  canManageProgrammes: boolean;
};

export async function loadNewSuggestionFormConfiguration(
  supabase: SupabaseClient,
  currentMembershipId: string | undefined,
): Promise<NewSuggestionFormConfiguration> {
  const { data: configurationData, error: configurationError } =
    await supabase.rpc("get_available_suggestion_submission_configuration");

  let loadError: string | null = null;
  let programmesForForm: Array<{ id: string; programme_name: string }> = [];
  let categoriesForForm: Array<{ id: string; name: string }> = [];

  if (configurationError) {
    loadError = "Unable to load suggestion configuration.";
  } else {
    const configuration = configurationData as SubmissionConfiguration | null;
    programmesForForm =
      configuration?.programmes?.map((programme) => ({
        id: programme.programme_version_id,
        programme_name: programme.programme_name,
      })) ?? [];
    categoriesForForm =
      configuration?.categories?.map((category) => ({
        id: category.category_id,
        name: category.category_name,
      })) ?? [];
  }

  const [
    { data: primaryUnitData },
    canManageJobFunctions,
    canManageProgrammes,
  ] = await Promise.all([
    supabase.rpc("get_current_membership_primary_unit"),
    currentMembershipId
      ? currentMemberHasPermission("job_functions.manage")
      : Promise.resolve(false),
    currentMemberHasPermission(SUGGESTIONS_PERMISSIONS.programmesManage),
  ]);

  const primaryUnit = primaryUnitData as {
    has_primary_unit?: boolean;
    unit_name?: string;
  } | null;

  return {
    loadError,
    programmesForForm,
    categoriesForForm,
    canManageProgrammes,
    primaryUnit: {
      hasPrimaryUnit: primaryUnit?.has_primary_unit === true,
      canManageAssignment: canManageJobFunctions,
      ...(currentMembershipId ? { membershipId: currentMembershipId } : {}),
      ...(primaryUnit?.unit_name ? { unitName: primaryUnit.unit_name } : {}),
    },
  };
}
