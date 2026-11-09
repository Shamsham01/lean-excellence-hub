import { mapValidationRowsFromDatabase } from "@/modules/workforce-import/credential-export";
import type {
  WorkforceImportRowInput,
  WorkforceImportValidationSummary,
} from "@/modules/workforce-import/constants";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";

export type WorkforceImportClientResult<T> =
  { ok: true; data: T } | { error: string };

export async function validateWorkforceImportJobInBrowser(
  jobId: string,
): Promise<WorkforceImportClientResult<WorkforceImportValidationSummary>> {
  const supabase = createBrowserSupabaseClient();
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

export async function loadWorkforceImportValidationRowsInBrowser(
  jobId: string,
) {
  const supabase = createBrowserSupabaseClient();
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

export async function loadWorkforceImportPreviewRowsInBrowser(jobId: string) {
  const supabase = createBrowserSupabaseClient();
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
