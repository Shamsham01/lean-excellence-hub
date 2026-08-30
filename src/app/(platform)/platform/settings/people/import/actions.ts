"use server";

import { revalidatePath } from "next/cache";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  buildValidationErrorReportCsv,
  mapValidationRowsFromDatabase,
} from "@/modules/workforce-import/credential-export";
import {
  invokeWorkforceImportCredentialExport,
  invokeWorkforceImportFinalize,
} from "@/modules/workforce-import/client";
import { invokeWorkforceProvision } from "@/modules/workforce-provision/client";
import {
  WORKFORCE_IMPORT_BATCH_SIZE,
  mapWorkforceImportProgressFromDatabase,
  type WorkforceImportProgress,
  type WorkforceImportRowInput,
  type WorkforceImportValidationSummary,
} from "@/modules/workforce-import/constants";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type WorkforceImportActionResult<T> =
  { ok: true; data: T } | { error: string };

async function assertCanImport(): Promise<{ error: string } | null> {
  const canImport = await currentMemberHasPermission("workforce.import");
  if (!canImport) {
    return { error: "You do not have permission to import workforce users." };
  }
  return null;
}

export async function createImportJob(
  originalFilename: string,
): Promise<WorkforceImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_workforce_import_job", {
    target_original_filename: originalFilename,
  });

  if (error || !data) {
    return {
      error: toCustomerErrorMessage(error, "Unable to start workforce import."),
    };
  }

  return { ok: true, data: { jobId: data as string } };
}

export async function submitImportRows(
  jobId: string,
  rows: WorkforceImportRowInput[],
): Promise<WorkforceImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("submit_workforce_import_rows", {
    target_import_job_id: jobId,
    target_rows: rows,
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to submit import rows."),
    };
  }

  return { ok: true, data: { jobId } };
}

export async function validateImportJob(
  jobId: string,
): Promise<WorkforceImportActionResult<WorkforceImportValidationSummary>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("validate_workforce_import_job", {
    target_import_job_id: jobId,
  });

  if (error || !data) {
    return {
      error: toCustomerErrorMessage(error, "Unable to validate import file."),
    };
  }

  const summary = data as {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
    can_provision: boolean;
  };

  return {
    ok: true,
    data: {
      totalRows: summary.total_rows,
      validRows: summary.valid_rows,
      errorRows: summary.error_rows,
      warningRows: summary.warning_rows,
      canProvision: summary.can_provision,
    },
  };
}

export async function getImportValidationRows(jobId: string) {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_workforce_import_validation_rows",
    { target_import_job_id: jobId },
  );

  if (error) {
    return {
      error: toCustomerErrorMessage(
        error,
        "Unable to load validation results.",
      ),
    };
  }

  return {
    ok: true as const,
    data: mapValidationRowsFromDatabase(
      (data ?? []) as unknown as Array<{
        row_number: number;
        status: string;
        input_payload: WorkforceImportRowInput;
        field_errors: Array<{
          field: string;
          issue: string;
          suggestion: string;
        }> | null;
      }>,
    ),
  };
}

export async function getImportPreviewRows(jobId: string) {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_workforce_import_preview_rows",
    { target_import_job_id: jobId },
  );

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to load import preview."),
    };
  }

  return {
    ok: true as const,
    data: (data ?? []) as Array<{
      row_number: number;
      display_name: string | null;
      username: string | null;
      job_function: string | null;
      primary_unit_path: string | null;
      application_role: string | null;
      access_scope_unit_path: string | null;
    }>,
  };
}

export async function startImportProvisioning(
  jobId: string,
): Promise<WorkforceImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("start_workforce_import_provisioning", {
    target_import_job_id: jobId,
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to start provisioning."),
    };
  }

  return { ok: true, data: { jobId } };
}

export async function runImportBatch(jobId: string): Promise<
  WorkforceImportActionResult<{
    claimed: number;
    succeeded: number;
    failed: number;
    remediation: number;
    progress: WorkforceImportProgress;
  }>
> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    "claim_workforce_import_batch",
    {
      target_import_job_id: jobId,
      target_batch_size: WORKFORCE_IMPORT_BATCH_SIZE,
    },
  );

  if (claimError) {
    return {
      error: toCustomerErrorMessage(
        claimError,
        "Unable to process workforce import batch.",
      ),
    };
  }

  const rows = (claimedRows ?? []) as Array<{
    import_row_id: string;
    provisioning_intent_id: string;
  }>;

  let succeeded = 0;
  let failed = 0;
  const remediation = 0;

  for (const row of rows) {
    const provision = await invokeWorkforceProvision(
      row.provisioning_intent_id,
    );
    if ("error" in provision) {
      const failure = await invokeWorkforceImportFinalize({
        importRowId: row.import_row_id,
        outcome: "failure",
        errorMessage: provision.error,
      });
      if ("error" in failure) {
        return { error: failure.error };
      }
      failed += 1;
      continue;
    }

    const finalized = await invokeWorkforceImportFinalize({
      importRowId: row.import_row_id,
      outcome: "success",
      membershipId: provision.membershipId,
      temporaryPassword: provision.temporaryPassword,
    });
    if ("error" in finalized) {
      const failure = await invokeWorkforceImportFinalize({
        importRowId: row.import_row_id,
        outcome: "failure",
        errorMessage: finalized.error,
      });
      if ("error" in failure) {
        return { error: failure.error };
      }
      failed += 1;
      continue;
    }

    succeeded += 1;
  }

  const progressResult = await getImportProgress(jobId);
  if ("error" in progressResult) {
    return { error: progressResult.error };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/platform/settings/people/import");
  revalidatePath(`/platform/settings/people/import/${jobId}`);
  revalidatePath("/platform/people");

  return {
    ok: true,
    data: {
      claimed: rows.length,
      succeeded,
      failed,
      remediation,
      progress: progressResult.data,
    },
  };
}

export async function getImportProgress(
  jobId: string,
): Promise<WorkforceImportActionResult<WorkforceImportProgress>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_workforce_import_job_progress",
    { target_import_job_id: jobId },
  );

  if (error || !data) {
    return {
      error: toCustomerErrorMessage(error, "Unable to load import progress."),
    };
  }

  const progress = data as {
    status: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
    provisioned_rows: number;
    failed_rows: number;
    remediation_rows: number;
    remaining_rows: number;
    credential_export_status: string;
    credential_expires_at: string | null;
    completed_at: string | null;
  };

  return {
    ok: true,
    data: mapWorkforceImportProgressFromDatabase(progress),
  };
}

export async function exportImportCredentials(
  jobId: string,
  organisationCode: string,
): Promise<WorkforceImportActionResult<{ csv: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const result = await invokeWorkforceImportCredentialExport(
    jobId,
    organisationCode,
  );
  if ("error" in result) {
    return { error: result.error };
  }

  return { ok: true, data: { csv: result.csv } };
}

export async function retryFailedImportRows(
  jobId: string,
): Promise<WorkforceImportActionResult<{ resetCount: number }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "retry_workforce_import_failed_rows",
    { target_import_job_id: jobId },
  );

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to retry failed rows."),
    };
  }

  return { ok: true, data: { resetCount: (data as number) ?? 0 } };
}

export async function buildImportErrorReport(
  jobId: string,
): Promise<WorkforceImportActionResult<{ csv: string }>> {
  const rowsResult = await getImportValidationRows(jobId);
  if ("error" in rowsResult) {
    return { error: rowsResult.error };
  }

  return {
    ok: true,
    data: {
      csv: buildValidationErrorReportCsv(rowsResult.data),
    },
  };
}

export async function getImportJobSnapshot(jobId: string): Promise<
  WorkforceImportActionResult<{
    jobId: string;
    originalFilename: string;
    totalRows: number;
    progress: WorkforceImportProgress;
  }>
> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data: job, error: jobError } = await supabase
    .from("workforce_import_jobs")
    .select("id, original_filename, total_rows")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return {
      error: toCustomerErrorMessage(jobError, "Import job was not found."),
    };
  }

  const progressResult = await getImportProgress(jobId);
  if ("error" in progressResult) {
    return progressResult;
  }

  return {
    ok: true,
    data: {
      jobId: job.id,
      originalFilename: job.original_filename,
      totalRows: job.total_rows,
      progress: progressResult.data,
    },
  };
}

export async function listRecentImportJobs() {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workforce_import_jobs")
    .select(
      "id, original_filename, total_rows, status, provisioned_rows, failed_rows, remediation_rows, credential_export_status, created_at, created_by_membership_id",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to load import history."),
    };
  }

  return { ok: true as const, data: data ?? [] };
}
