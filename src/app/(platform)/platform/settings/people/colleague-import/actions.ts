"use server";

import { revalidatePath } from "next/cache";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import {
  mapPeopleInvitationImportProgressFromDatabase,
  PEOPLE_INVITATION_IMPORT_BATCH_SIZE,
  type PeopleInvitationImportProgress,
  type PeopleInvitationImportRowInput,
  type PeopleInvitationImportValidationSummary,
} from "@/modules/people-invitation-import/constants";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type PeopleInvitationImportActionResult<T> =
  { ok: true; data: T } | { error: string };

async function assertCanImport(): Promise<{ error: string } | null> {
  const [canInvite, canDelegate] = await Promise.all([
    currentMemberHasPermission("invitations.manage"),
    currentMemberHasPermission("roles.delegate"),
  ]);
  if (!canInvite || !canDelegate) {
    return {
      error: "You do not have permission to import colleague invitations.",
    };
  }
  return null;
}

export async function createColleagueImportJob(
  originalFilename: string,
  contentFingerprint?: string,
): Promise<PeopleInvitationImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_people_invitation_import_job",
    {
      target_original_filename: originalFilename,
      ...(contentFingerprint
        ? { target_content_fingerprint: contentFingerprint }
        : {}),
    },
  );

  if (error || !data) {
    return {
      error: toCustomerErrorMessage(error, "Unable to start colleague import."),
    };
  }

  return { ok: true, data: { jobId: data as string } };
}

export async function submitColleagueImportRows(
  jobId: string,
  rows: PeopleInvitationImportRowInput[],
): Promise<PeopleInvitationImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("submit_people_invitation_import_rows", {
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

export async function validateColleagueImportJob(
  jobId: string,
): Promise<
  PeopleInvitationImportActionResult<PeopleInvitationImportValidationSummary>
> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "validate_people_invitation_import_job",
    { target_import_job_id: jobId },
  );

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
    can_import: boolean;
  };

  return {
    ok: true,
    data: {
      totalRows: summary.total_rows,
      validRows: summary.valid_rows,
      errorRows: summary.error_rows,
      warningRows: summary.warning_rows,
      canImport: summary.can_import,
    },
  };
}

export async function getColleagueImportValidationRows(jobId: string) {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_people_invitation_import_validation_rows",
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
    data: (data ?? []).map((row) => {
      const fieldErrors = Array.isArray(row.field_errors)
        ? (row.field_errors as Array<{
            field: string;
            issue: string;
            suggestion: string;
          }>)
        : [];
      return {
        rowNumber: row.row_number,
        recordType: row.record_type,
        label: row.label,
        status: row.status,
        fieldErrors,
      };
    }),
  };
}

export async function getColleagueImportPreviewRows(jobId: string) {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_people_invitation_import_preview_rows",
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
      record_type: string;
      display_name: string | null;
      email: string | null;
      department: string | null;
      site: string | null;
      application_role: string | null;
      access_scope_site: string | null;
    }>,
  };
}

export async function startColleagueImport(
  jobId: string,
): Promise<PeopleInvitationImportActionResult<{ jobId: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("start_people_invitation_import", {
    target_import_job_id: jobId,
  });

  if (error) {
    return {
      error: toCustomerErrorMessage(error, "Unable to start colleague import."),
    };
  }

  return { ok: true, data: { jobId } };
}

export async function runColleagueImportBatch(jobId: string): Promise<
  PeopleInvitationImportActionResult<{
    claimed: number;
    progress: PeopleInvitationImportProgress;
  }>
> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    "claim_people_invitation_import_batch",
    {
      target_import_job_id: jobId,
      target_batch_size: PEOPLE_INVITATION_IMPORT_BATCH_SIZE,
    },
  );

  if (claimError) {
    return {
      error: toCustomerErrorMessage(
        claimError,
        "Unable to process colleague import batch.",
      ),
    };
  }

  const progressResult = await getColleagueImportProgress(jobId);
  if ("error" in progressResult) {
    return { error: progressResult.error };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/platform/settings/people/colleague-import");
  revalidatePath("/platform/people");

  return {
    ok: true,
    data: {
      claimed: (claimedRows ?? []).length,
      progress: progressResult.data,
    },
  };
}

export async function getColleagueImportProgress(
  jobId: string,
): Promise<PeopleInvitationImportActionResult<PeopleInvitationImportProgress>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_people_invitation_import_progress",
    { target_import_job_id: jobId },
  );

  if (error || !data) {
    return {
      error: toCustomerErrorMessage(error, "Unable to load import progress."),
    };
  }

  return {
    ok: true,
    data: mapPeopleInvitationImportProgressFromDatabase(
      data as Record<string, unknown>,
    ),
  };
}

export async function buildColleagueImportErrorReport(
  jobId: string,
): Promise<PeopleInvitationImportActionResult<{ csv: string }>> {
  const denied = await assertCanImport();
  if (denied) return denied;

  const rowsResult = await getColleagueImportValidationRows(jobId);
  if ("error" in rowsResult) {
    return { error: rowsResult.error };
  }

  const lines = ["row_number,record_type,label,status,field,issue,suggestion"];

  for (const row of rowsResult.data) {
    if (row.status === "valid") continue;
    if (row.fieldErrors.length === 0) {
      lines.push(
        `${row.rowNumber},${row.recordType},"${row.label.replaceAll('"', '""')}",${row.status},,,`,
      );
      continue;
    }
    for (const fieldError of row.fieldErrors) {
      lines.push(
        [
          row.rowNumber,
          row.recordType,
          `"${row.label.replaceAll('"', '""')}"`,
          row.status,
          fieldError.field,
          `"${fieldError.issue.replaceAll('"', '""')}"`,
          `"${fieldError.suggestion.replaceAll('"', '""')}"`,
        ].join(","),
      );
    }
  }

  return { ok: true, data: { csv: lines.join("\n") } };
}
