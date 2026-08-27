"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

type RpcArgs = Record<string, unknown>;
type ActionResult = { error?: string; ok?: true; id?: string };

async function callRpc<T = unknown>(fn: string, args?: RpcArgs): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    fn as "create_benefit_draft",
    (args ?? {}) as never,
  );
  if (error) throw error;
  return data as T;
}

function revalidateBenefitPaths(benefitId?: string) {
  revalidatePath("/platform/benefits");
  revalidatePath("/platform/benefits/validation");
  revalidatePath("/platform");
  if (benefitId) {
    revalidatePath(`/platform/benefits/${benefitId}`);
  }
}

type BenefitWizardPeriodInput = {
  period_start: string;
  period_end: string;
  forecast_amount: number;
  display_order: number;
};

export async function createBenefitWizardDraft(input: {
  title: string;
  organisationalUnitId: string;
  benefitClass: string;
  description?: string;
  financialType?: string;
  nonFinancialType?: string;
  categoryId?: string;
  ownerMembershipId: string;
  isStandaloneInitiative?: boolean;
  primarySourceResourceId?: string;
  baselineDescription?: string;
  baselinePeriodStart?: string;
  baselinePeriodEnd?: string;
  baselineMeasureValue?: number;
  baselineMeasureUnit?: string;
  baselineFinancialValue?: number;
  plannedRealisationStart?: string;
  plannedRealisationEnd?: string;
  realisationPattern?: string;
  forecastStartDate?: string;
  forecastEndDate?: string;
  forecastTotalAmount?: number;
  calculationBasis?: string;
  assumptions?: string;
  targetMeasureValue?: number;
  targetMeasureUnit?: string;
  targetDate?: string;
  forecastPeriods?: BenefitWizardPeriodInput[];
  sourceResourceId?: string;
}): Promise<ActionResult> {
  try {
    const benefitId = await callRpc<string>("create_benefit_draft", {
      target_title: input.title,
      target_organisational_unit_id: input.organisationalUnitId,
      target_benefit_class: input.benefitClass,
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.isStandaloneInitiative !== undefined
        ? { target_is_standalone_initiative: input.isStandaloneInitiative }
        : {}),
      ...(input.primarySourceResourceId
        ? { target_primary_source_resource_id: input.primarySourceResourceId }
        : {}),
    });

    await callRpc("update_benefit_draft", {
      target_benefit_id: benefitId,
      target_title: input.title,
      ...(input.description !== undefined
        ? { target_description: input.description }
        : {}),
      ...(input.benefitClass
        ? { target_benefit_class: input.benefitClass }
        : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.organisationalUnitId
        ? { target_organisational_unit_id: input.organisationalUnitId }
        : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.baselineDescription
        ? { target_baseline_description: input.baselineDescription }
        : {}),
      ...(input.baselinePeriodStart
        ? { target_baseline_period_start: input.baselinePeriodStart }
        : {}),
      ...(input.baselinePeriodEnd
        ? { target_baseline_period_end: input.baselinePeriodEnd }
        : {}),
      ...(input.baselineMeasureValue !== undefined
        ? { target_baseline_measure_value: input.baselineMeasureValue }
        : {}),
      ...(input.baselineMeasureUnit
        ? { target_baseline_measure_unit: input.baselineMeasureUnit }
        : {}),
      ...(input.baselineFinancialValue !== undefined
        ? { target_baseline_financial_value: input.baselineFinancialValue }
        : {}),
      ...(input.plannedRealisationStart
        ? { target_planned_realisation_start: input.plannedRealisationStart }
        : {}),
      ...(input.plannedRealisationEnd
        ? { target_planned_realisation_end: input.plannedRealisationEnd }
        : {}),
      ...(input.isStandaloneInitiative !== undefined
        ? { target_is_standalone_initiative: input.isStandaloneInitiative }
        : {}),
    });

    if (
      input.forecastStartDate &&
      input.forecastEndDate &&
      input.realisationPattern
    ) {
      const forecastId = await callRpc<string>(
        "create_benefit_forecast_draft",
        {
          target_benefit_id: benefitId,
          target_realisation_pattern: input.realisationPattern,
          target_forecast_start_date: input.forecastStartDate,
          target_forecast_end_date: input.forecastEndDate,
          ...(input.forecastTotalAmount !== undefined
            ? { target_forecast_total_amount: input.forecastTotalAmount }
            : {}),
          ...(input.calculationBasis
            ? { target_calculation_basis: input.calculationBasis }
            : {}),
          ...(input.assumptions
            ? { target_assumptions: input.assumptions }
            : {}),
          ...(input.targetMeasureValue !== undefined
            ? { target_target_measure_value: input.targetMeasureValue }
            : {}),
          ...(input.targetMeasureUnit
            ? { target_target_measure_unit: input.targetMeasureUnit }
            : {}),
          ...(input.targetDate ? { target_target_date: input.targetDate } : {}),
        },
      );

      if (input.forecastPeriods && input.forecastPeriods.length > 0) {
        await callRpc("replace_benefit_forecast_periods", {
          target_forecast_version_id: forecastId,
          target_periods: input.forecastPeriods,
        });
      }
    }

    if (input.sourceResourceId) {
      await callRpc("add_benefit_source_link", {
        target_benefit_id: benefitId,
        target_source_resource_id: input.sourceResourceId,
        target_relationship_role: "contributing",
      });
    }

    revalidateBenefitPaths(benefitId);
    return { ok: true, id: benefitId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Create failed" };
  }
}

export async function createBenefitDraft(input: {
  title: string;
  organisationalUnitId: string;
  benefitClass: string;
  description?: string;
  financialType?: string;
  nonFinancialType?: string;
  categoryId?: string;
  ownerMembershipId?: string;
  isStandaloneInitiative?: boolean;
  primarySourceResourceId?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_draft", {
      target_title: input.title,
      target_organisational_unit_id: input.organisationalUnitId,
      target_benefit_class: input.benefitClass,
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.isStandaloneInitiative !== undefined
        ? { target_is_standalone_initiative: input.isStandaloneInitiative }
        : {}),
      ...(input.primarySourceResourceId
        ? { target_primary_source_resource_id: input.primarySourceResourceId }
        : {}),
    });
    revalidateBenefitPaths(id);
    return { ok: true, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Create failed" };
  }
}

export async function updateBenefitDraft(input: {
  benefitId: string;
  title: string;
  description?: string;
  benefitClass?: string;
  financialType?: string;
  nonFinancialType?: string;
  categoryId?: string;
  organisationalUnitId?: string;
  ownerMembershipId?: string;
  baselineDescription?: string;
  baselinePeriodStart?: string;
  baselinePeriodEnd?: string;
  baselineMeasureValue?: number;
  baselineMeasureUnit?: string;
  baselineFinancialValue?: number;
  plannedRealisationStart?: string;
  plannedRealisationEnd?: string;
  isStandaloneInitiative?: boolean;
}): Promise<ActionResult> {
  try {
    await callRpc("update_benefit_draft", {
      target_benefit_id: input.benefitId,
      target_title: input.title,
      ...(input.description !== undefined
        ? { target_description: input.description }
        : {}),
      ...(input.benefitClass
        ? { target_benefit_class: input.benefitClass }
        : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.organisationalUnitId
        ? { target_organisational_unit_id: input.organisationalUnitId }
        : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
      ...(input.baselineDescription
        ? { target_baseline_description: input.baselineDescription }
        : {}),
      ...(input.baselinePeriodStart
        ? { target_baseline_period_start: input.baselinePeriodStart }
        : {}),
      ...(input.baselinePeriodEnd
        ? { target_baseline_period_end: input.baselinePeriodEnd }
        : {}),
      ...(input.baselineMeasureValue !== undefined
        ? { target_baseline_measure_value: input.baselineMeasureValue }
        : {}),
      ...(input.baselineMeasureUnit
        ? { target_baseline_measure_unit: input.baselineMeasureUnit }
        : {}),
      ...(input.baselineFinancialValue !== undefined
        ? { target_baseline_financial_value: input.baselineFinancialValue }
        : {}),
      ...(input.plannedRealisationStart
        ? { target_planned_realisation_start: input.plannedRealisationStart }
        : {}),
      ...(input.plannedRealisationEnd
        ? { target_planned_realisation_end: input.plannedRealisationEnd }
        : {}),
      ...(input.isStandaloneInitiative !== undefined
        ? { target_is_standalone_initiative: input.isStandaloneInitiative }
        : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Update failed" };
  }
}

export async function addBenefitSourceLink(
  benefitId: string,
  sourceResourceId: string,
  relationshipRole = "contributing",
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("add_benefit_source_link", {
      target_benefit_id: benefitId,
      target_source_resource_id: sourceResourceId,
      target_relationship_role: relationshipRole,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Link failed" };
  }
}

export async function removeBenefitSourceLink(
  benefitId: string,
  sourceResourceId: string,
): Promise<ActionResult> {
  try {
    await callRpc("remove_benefit_source_link", {
      target_benefit_id: benefitId,
      target_source_resource_id: sourceResourceId,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unlink failed" };
  }
}

export async function getEligibleBenefitValidators(benefitId: string): Promise<{
  data?: {
    benefit_class: string;
    candidates: Array<{
      membership_id: string;
      display_name: string;
      can_validate_ci: boolean;
      can_validate_finance: boolean;
    }>;
    default_ci_validator_membership_id: string | null;
    default_finance_validator_membership_id: string | null;
    requires_explicit_ci_selection: boolean;
    requires_explicit_finance_selection: boolean;
  };
  error?: string;
}> {
  try {
    const data = await callRpc<{
      benefit_class: string;
      candidates: Array<{
        membership_id: string;
        display_name: string;
        can_validate_ci: boolean;
        can_validate_finance: boolean;
      }>;
      default_ci_validator_membership_id: string | null;
      default_finance_validator_membership_id: string | null;
      requires_explicit_ci_selection: boolean;
      requires_explicit_finance_selection: boolean;
    }>("get_eligible_benefit_validators", {
      target_benefit_id: benefitId,
    });
    return { data };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to load validator options",
    };
  }
}

export async function submitBenefit(
  benefitId: string,
  ciValidatorMembershipId: string,
  financeValidatorMembershipId?: string,
): Promise<ActionResult> {
  try {
    await callRpc("submit_benefit", {
      target_benefit_id: benefitId,
      target_ci_validator_membership_id: ciValidatorMembershipId,
      ...(financeValidatorMembershipId
        ? {
            target_finance_validator_membership_id:
              financeValidatorMembershipId,
          }
        : {}),
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Submit failed" };
  }
}

export async function returnBenefitToDraft(
  benefitId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("return_benefit_to_draft", {
      target_benefit_id: benefitId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Return failed" };
  }
}

export async function recordBenefitValidation(
  benefitId: string,
  validationRole: string,
  decision: string,
  rationale: string,
): Promise<ActionResult> {
  try {
    await callRpc("record_benefit_validation", {
      target_benefit_id: benefitId,
      target_validation_role: validationRole,
      target_decision: decision,
      target_rationale: rationale,
    });
    revalidateBenefitPaths(benefitId);
    revalidatePath("/platform/benefits/validation");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

export async function startBenefitRealisation(
  benefitId: string,
): Promise<ActionResult> {
  try {
    await callRpc("start_benefit_realisation", {
      target_benefit_id: benefitId,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Start realisation failed",
    };
  }
}

export async function markBenefitRealised(
  benefitId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("mark_benefit_realised", {
      target_benefit_id: benefitId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Mark realised failed",
    };
  }
}

export async function withdrawBenefit(
  benefitId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("withdraw_benefit", {
      target_benefit_id: benefitId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Withdraw failed",
    };
  }
}

export async function cancelBenefit(
  benefitId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("cancel_benefit", {
      target_benefit_id: benefitId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cancel failed" };
  }
}

export async function createBenefitForecastDraft(input: {
  benefitId: string;
  realisationPattern: string;
  forecastStartDate: string;
  forecastEndDate: string;
  forecastTotalAmount?: number;
  calculationBasis?: string;
  assumptions?: string;
  targetMeasureValue?: number;
  targetMeasureUnit?: string;
  targetDate?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_forecast_draft", {
      target_benefit_id: input.benefitId,
      target_realisation_pattern: input.realisationPattern,
      target_forecast_start_date: input.forecastStartDate,
      target_forecast_end_date: input.forecastEndDate,
      ...(input.forecastTotalAmount !== undefined
        ? { target_forecast_total_amount: input.forecastTotalAmount }
        : {}),
      ...(input.calculationBasis
        ? { target_calculation_basis: input.calculationBasis }
        : {}),
      ...(input.assumptions ? { target_assumptions: input.assumptions } : {}),
      ...(input.targetMeasureValue !== undefined
        ? { target_target_measure_value: input.targetMeasureValue }
        : {}),
      ...(input.targetMeasureUnit
        ? { target_target_measure_unit: input.targetMeasureUnit }
        : {}),
      ...(input.targetDate ? { target_target_date: input.targetDate } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forecast draft failed",
    };
  }
}

export async function updateBenefitForecastDraft(input: {
  forecastVersionId: string;
  benefitId: string;
  realisationPattern: string;
  forecastStartDate: string;
  forecastEndDate: string;
  forecastTotalAmount?: number;
  calculationBasis?: string;
  assumptions?: string;
  targetMeasureValue?: number;
  targetMeasureUnit?: string;
  targetDate?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("update_benefit_forecast_draft", {
      target_forecast_version_id: input.forecastVersionId,
      target_realisation_pattern: input.realisationPattern,
      target_forecast_start_date: input.forecastStartDate,
      target_forecast_end_date: input.forecastEndDate,
      ...(input.forecastTotalAmount !== undefined
        ? { target_forecast_total_amount: input.forecastTotalAmount }
        : {}),
      ...(input.calculationBasis
        ? { target_calculation_basis: input.calculationBasis }
        : {}),
      ...(input.assumptions ? { target_assumptions: input.assumptions } : {}),
      ...(input.targetMeasureValue !== undefined
        ? { target_target_measure_value: input.targetMeasureValue }
        : {}),
      ...(input.targetMeasureUnit
        ? { target_target_measure_unit: input.targetMeasureUnit }
        : {}),
      ...(input.targetDate ? { target_target_date: input.targetDate } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forecast update failed",
    };
  }
}

export async function replaceBenefitForecastPeriods(
  forecastVersionId: string,
  benefitId: string,
  periods: Array<{
    period_start: string;
    period_end: string;
    forecast_amount: number;
    display_order: number;
  }>,
): Promise<ActionResult> {
  try {
    await callRpc("replace_benefit_forecast_periods", {
      target_forecast_version_id: forecastVersionId,
      target_periods: periods,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Period replace failed",
    };
  }
}

export async function submitBenefitForecast(
  forecastVersionId: string,
  benefitId: string,
): Promise<ActionResult> {
  try {
    await callRpc("submit_benefit_forecast", {
      target_forecast_version_id: forecastVersionId,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forecast submit failed",
    };
  }
}

export async function approveBenefitForecast(
  forecastVersionId: string,
  benefitId: string,
): Promise<ActionResult> {
  try {
    await callRpc("approve_benefit_forecast", {
      target_forecast_version_id: forecastVersionId,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forecast approve failed",
    };
  }
}

export async function createBenefitForecastSuccessorVersion(
  benefitId: string,
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>(
      "create_benefit_forecast_successor_version",
      {
        target_benefit_id: benefitId,
      },
    );
    revalidateBenefitPaths(benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Successor forecast failed",
    };
  }
}

export async function createBenefitRealisationEntry(input: {
  benefitId: string;
  periodStart: string;
  periodEnd: string;
  financialAmount?: number;
  measureValue?: number;
  measureUnit?: string;
  dataSource?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_realisation_entry", {
      target_benefit_id: input.benefitId,
      target_period_start: input.periodStart,
      target_period_end: input.periodEnd,
      ...(input.financialAmount !== undefined
        ? { target_financial_amount: input.financialAmount }
        : {}),
      ...(input.measureValue !== undefined
        ? { target_measure_value: input.measureValue }
        : {}),
      ...(input.measureUnit ? { target_measure_unit: input.measureUnit } : {}),
      ...(input.dataSource ? { target_data_source: input.dataSource } : {}),
      ...(input.notes ? { target_notes: input.notes } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Entry create failed",
    };
  }
}

export async function createBenefitRealisationAdjustment(input: {
  parentEntryId: string;
  benefitId: string;
  financialAmount?: number;
  measureValue?: number;
  measureUnit?: string;
  periodStart?: string;
  periodEnd?: string;
  dataSource?: string;
  notes?: string;
  isCorrection?: boolean;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_realisation_adjustment", {
      target_parent_entry_id: input.parentEntryId,
      ...(input.financialAmount !== undefined
        ? { target_financial_amount: input.financialAmount }
        : {}),
      ...(input.measureValue !== undefined
        ? { target_measure_value: input.measureValue }
        : {}),
      ...(input.measureUnit ? { target_measure_unit: input.measureUnit } : {}),
      ...(input.periodStart ? { target_period_start: input.periodStart } : {}),
      ...(input.periodEnd ? { target_period_end: input.periodEnd } : {}),
      ...(input.dataSource ? { target_data_source: input.dataSource } : {}),
      ...(input.notes ? { target_notes: input.notes } : {}),
      ...(input.isCorrection !== undefined
        ? { target_is_correction: input.isCorrection }
        : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Adjustment failed",
    };
  }
}

export async function submitBenefitRealisationEntry(
  entryId: string,
  benefitId: string,
): Promise<ActionResult> {
  try {
    await callRpc("submit_benefit_realisation_entry", {
      target_entry_id: entryId,
    });
    revalidateBenefitPaths(benefitId);
    revalidatePath("/platform/benefits/validation");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Entry submit failed",
    };
  }
}

export async function validateBenefitRealisationEntry(
  entryId: string,
  benefitId: string,
): Promise<ActionResult> {
  try {
    await callRpc("validate_benefit_realisation_entry", {
      target_entry_id: entryId,
    });
    revalidateBenefitPaths(benefitId);
    revalidatePath("/platform/benefits/validation");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Entry validate failed",
    };
  }
}

export async function rejectBenefitRealisationEntry(
  entryId: string,
  benefitId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await callRpc("reject_benefit_realisation_entry", {
      target_entry_id: entryId,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidateBenefitPaths(benefitId);
    revalidatePath("/platform/benefits/validation");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Entry reject failed",
    };
  }
}

export async function createBenefitOverlapGroup(
  name: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_overlap_group", {
      target_name: name,
      ...(reason ? { target_reason: reason } : {}),
    });
    revalidatePath("/platform/benefits");
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Overlap group failed",
    };
  }
}

export async function addBenefitToOverlapGroup(input: {
  overlapGroupId: string;
  benefitId: string;
  allocationPercentage: number;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("add_benefit_to_overlap_group", {
      target_overlap_group_id: input.overlapGroupId,
      target_benefit_id: input.benefitId,
      target_allocation_percentage: input.allocationPercentage,
      ...(input.reason ? { target_reason: input.reason } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Overlap add failed",
    };
  }
}

export async function updateBenefitOverlapAllocation(input: {
  overlapGroupId: string;
  benefitId: string;
  allocationPercentage: number;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("update_benefit_overlap_allocation", {
      target_overlap_group_id: input.overlapGroupId,
      target_benefit_id: input.benefitId,
      target_allocation_percentage: input.allocationPercentage,
      ...(input.reason ? { target_reason: input.reason } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Overlap update failed",
    };
  }
}

export async function removeBenefitFromOverlapGroup(input: {
  overlapGroupId: string;
  benefitId: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    await callRpc("remove_benefit_from_overlap_group", {
      target_overlap_group_id: input.overlapGroupId,
      target_benefit_id: input.benefitId,
      ...(input.reason ? { target_reason: input.reason } : {}),
    });
    revalidateBenefitPaths(input.benefitId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Overlap remove failed",
    };
  }
}

export async function createBenefitFromCiProject(input: {
  projectId: string;
  benefitClass: string;
  title?: string;
  description?: string;
  financialType?: string;
  nonFinancialType?: string;
  categoryId?: string;
  organisationalUnitId?: string;
  ownerMembershipId?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_from_ci_project", {
      target_project_id: input.projectId,
      target_benefit_class: input.benefitClass,
      ...(input.title ? { target_title: input.title } : {}),
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.organisationalUnitId
        ? { target_organisational_unit_id: input.organisationalUnitId }
        : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
    });
    revalidateBenefitPaths(id);
    revalidatePath(`/platform/projects/${input.projectId}`);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Create from project failed",
    };
  }
}

export async function createBenefitFromSuggestion(input: {
  suggestionId: string;
  benefitClass: string;
  title?: string;
  description?: string;
  financialType?: string;
  nonFinancialType?: string;
  categoryId?: string;
  organisationalUnitId?: string;
  ownerMembershipId?: string;
}): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("create_benefit_from_suggestion", {
      target_suggestion_id: input.suggestionId,
      target_benefit_class: input.benefitClass,
      ...(input.title ? { target_title: input.title } : {}),
      ...(input.description ? { target_description: input.description } : {}),
      ...(input.financialType
        ? { target_financial_type: input.financialType }
        : {}),
      ...(input.nonFinancialType
        ? { target_non_financial_type: input.nonFinancialType }
        : {}),
      ...(input.categoryId ? { target_category_id: input.categoryId } : {}),
      ...(input.organisationalUnitId
        ? { target_organisational_unit_id: input.organisationalUnitId }
        : {}),
      ...(input.ownerMembershipId
        ? { target_owner_membership_id: input.ownerMembershipId }
        : {}),
    });
    revalidateBenefitPaths(id);
    revalidatePath(`/platform/suggestions/${input.suggestionId}`);
    return { ok: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Create from suggestion failed",
    };
  }
}

export async function linkBenefitEvidence(
  benefitId: string,
  attachmentId: string,
): Promise<ActionResult> {
  try {
    const id = await callRpc<string>("link_benefit_evidence", {
      target_benefit_id: benefitId,
      target_attachment_id: attachmentId,
    });
    revalidateBenefitPaths(benefitId);
    return { ok: true, id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Evidence link failed",
    };
  }
}

export async function createBenefitCategory(input: {
  name: string;
  code: string;
  description?: string;
  displayOrder?: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  try {
    const { data, error } = await supabase.rpc("create_benefit_category", {
      target_name: input.name.trim(),
      target_code: input.code.trim(),
      ...(input.description !== undefined
        ? { target_description: input.description }
        : {}),
      target_display_order: input.displayOrder ?? 0,
    });
    if (error) throw error;
    revalidatePath("/platform/benefits/categories");
    revalidatePath("/platform/benefits/new");
    return { ok: true, id: data as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Category create failed",
    };
  }
}

export async function updateBenefitCategory(input: {
  categoryId: string;
  name: string;
  description?: string;
  displayOrder?: number;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  try {
    const { error } = await supabase.rpc("update_benefit_category", {
      target_category_id: input.categoryId,
      target_name: input.name.trim(),
      ...(input.description !== undefined
        ? { target_description: input.description }
        : {}),
      ...(input.displayOrder !== undefined
        ? { target_display_order: input.displayOrder }
        : {}),
    });
    if (error) throw error;
    revalidatePath("/platform/benefits/categories");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Category update failed",
    };
  }
}

export async function archiveBenefitCategory(
  categoryId: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  try {
    const { error } = await supabase.rpc("archive_benefit_category", {
      target_category_id: categoryId,
    });
    if (error) throw error;
    revalidatePath("/platform/benefits/categories");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Category archive failed",
    };
  }
}

export async function upsertBenefitReportingSettings(
  fiscalYearStartMonth: number,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  try {
    const { error } = await supabase.rpc("upsert_benefit_reporting_settings", {
      target_fiscal_year_start_month: fiscalYearStartMonth,
    });
    if (error) throw error;
    revalidatePath("/platform/benefits/categories");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Reporting settings update failed",
    };
  }
}
