import { expect, type Page } from "@playwright/test";

import { mapWorkforceImportProgressFromDatabase } from "@/modules/workforce-import/constants";

import {
  createDemoAdminSession,
  queryDatabase,
} from "./workforce-provisioning";

export const WORKFORCE_IMPORT_TERMINAL_STATUSES = [
  "completed",
  "completed_with_remediation",
  "failed",
  "cancelled",
] as const;

export type WorkforceImportTerminalStatus =
  (typeof WORKFORCE_IMPORT_TERMINAL_STATUSES)[number];

export type WorkforceImportJobProgress = {
  jobId: string;
  status: string;
  totalRows: number;
  provisionedRows: number;
  failedRows: number;
  remediationRows: number;
  credentialExportStatus: string;
  remainingRows: number;
  completedAt: string | null;
};

export function formatImportProgressDiagnostics(
  progress: WorkforceImportJobProgress | null,
): string {
  if (!progress) {
    return "importJob=not_found";
  }

  return [
    `jobId=${progress.jobId}`,
    `status=${progress.status}`,
    `provisionedRows=${progress.provisionedRows}`,
    `failedRows=${progress.failedRows}`,
    `remainingRows=${progress.remainingRows}`,
    `credentialExportStatus=${progress.credentialExportStatus}`,
  ].join("; ");
}

export async function readImportWizardDiagnostics(page: Page): Promise<string> {
  const jobId =
    (await page.getByTestId("workforce-import-job-id").textContent())?.trim() ??
    "none";
  const message =
    (await page.getByTestId("import-message").textContent())?.trim() ?? "none";
  const countText =
    (
      await page.getByTestId("import-provisioned-count").textContent()
    )?.trim() ?? "absent";
  const downloadVisible = await page
    .getByTestId("download-import-credentials")
    .isVisible()
    .catch(() => false);

  return [
    `url=${page.url()}`,
    `jobId=${jobId}`,
    `importMessage="${message}"`,
    `provisionedCount="${countText}"`,
    `downloadButtonVisible=${downloadVisible}`,
  ].join("; ");
}

function mapRpcProgress(
  jobId: string,
  progress: Record<string, unknown>,
): WorkforceImportJobProgress {
  const mapped = mapWorkforceImportProgressFromDatabase(progress);
  return {
    jobId,
    status: mapped.status,
    totalRows: mapped.totalRows,
    provisionedRows: mapped.provisionedRows,
    failedRows: mapped.failedRows,
    remediationRows: mapped.remediationRows,
    credentialExportStatus: mapped.credentialExportStatus,
    remainingRows: mapped.remainingRows,
    completedAt: mapped.completedAt,
  };
}

async function queryWorkforceImportJobProgressViaRpc(
  jobId: string,
): Promise<WorkforceImportJobProgress | null> {
  const { client } = await createDemoAdminSession();
  const { data, error } = await client.rpc(
    "get_workforce_import_job_progress",
    {
      target_import_job_id: jobId,
    },
  );

  if (error || !data) {
    return null;
  }

  return mapRpcProgress(jobId, data as Record<string, unknown>);
}

function queryWorkforceImportJobProgressViaSql(
  jobId: string,
): WorkforceImportJobProgress | null {
  const rows = queryDatabase<{
    id: string;
    status: string;
    total_rows: number;
    provisioned_rows: number;
    failed_rows: number;
    remediation_rows: number;
    credential_export_status: string;
    completed_at: string | null;
    remaining_rows: string;
  }>(`
    select
      import_job.id,
      import_job.status,
      import_job.total_rows,
      import_job.provisioned_rows,
      import_job.failed_rows,
      import_job.remediation_rows,
      import_job.credential_export_status,
      import_job.completed_at,
      (
        select count(*)::text
        from public.workforce_import_rows import_row
        where import_row.import_job_id = import_job.id
          and import_row.status in ('valid', 'warning', 'provisioning', 'failed')
      ) as remaining_rows
    from public.workforce_import_jobs import_job
    where import_job.id = '${jobId}'
    limit 1
  `);

  const job = rows[0];
  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    status: job.status,
    totalRows: job.total_rows,
    provisionedRows: job.provisioned_rows,
    failedRows: job.failed_rows,
    remediationRows: job.remediation_rows,
    credentialExportStatus: job.credential_export_status,
    remainingRows: Number(job.remaining_rows ?? 0),
    completedAt: job.completed_at,
  };
}

export async function queryWorkforceImportJobProgress(
  jobId: string,
): Promise<WorkforceImportJobProgress | null> {
  const rpcProgress = await queryWorkforceImportJobProgressViaRpc(jobId);
  if (rpcProgress) {
    return rpcProgress;
  }

  return queryWorkforceImportJobProgressViaSql(jobId);
}

function isTerminalImportProgress(
  progress: WorkforceImportJobProgress,
): boolean {
  return (
    WORKFORCE_IMPORT_TERMINAL_STATUSES.includes(
      progress.status as WorkforceImportTerminalStatus,
    ) && progress.remainingRows === 0
  );
}

export async function waitForWorkforceImportTerminalState(
  jobId: string,
  options?: { timeoutMs?: number },
): Promise<WorkforceImportJobProgress> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const deadline = Date.now() + timeoutMs;
  let latest: WorkforceImportJobProgress | null = null;

  while (Date.now() < deadline) {
    latest = await queryWorkforceImportJobProgress(jobId);
    if (latest && isTerminalImportProgress(latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Import job did not reach terminal state within ${timeoutMs}ms. ${formatImportProgressDiagnostics(latest)}`,
  );
}

export async function waitForImportProvisioningCheckpoint(
  jobId: string,
  minProvisioned: number,
  options?: { timeoutMs?: number },
): Promise<WorkforceImportJobProgress> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  let latest: WorkforceImportJobProgress | null = null;

  while (Date.now() < deadline) {
    latest = await queryWorkforceImportJobProgress(jobId);
    if (
      latest &&
      latest.status === "provisioning" &&
      latest.provisionedRows >= minProvisioned &&
      latest.remainingRows > 0
    ) {
      return latest;
    }

    if (latest && isTerminalImportProgress(latest)) {
      throw new Error(
        `Import job completed before checkpoint (provisioned=${latest.provisionedRows}, needed>=${minProvisioned} with remaining>0). ${formatImportProgressDiagnostics(latest)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Import job did not reach provisioning checkpoint within ${timeoutMs}ms. ${formatImportProgressDiagnostics(latest)}`,
  );
}

export async function readWorkforceImportJobId(page: Page): Promise<string> {
  const jobId = (
    await page.getByTestId("workforce-import-job-id").textContent()
  )?.trim();
  if (!jobId) {
    throw new Error(
      `Workforce import job id was not available. ${await readImportWizardDiagnostics(page)}`,
    );
  }
  return jobId;
}

export async function awaitImportCredentialsDownloadReady(
  page: Page,
  jobId: string,
  options?: { timeoutMs?: number },
): Promise<WorkforceImportJobProgress> {
  const timeoutMs = options?.timeoutMs ?? 240_000;
  const deadline = Date.now() + timeoutMs;
  let latest: WorkforceImportJobProgress | null = null;

  while (Date.now() < deadline) {
    latest = await queryWorkforceImportJobProgress(jobId);

    const downloadVisible = await page
      .getByTestId("download-import-credentials")
      .isVisible()
      .catch(() => false);

    if (
      latest &&
      isTerminalImportProgress(latest) &&
      latest.provisionedRows > 0 &&
      (latest.credentialExportStatus === "available" ||
        latest.credentialExportStatus === "exported") &&
      downloadVisible
    ) {
      return latest;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Import credentials were not ready within ${timeoutMs}ms. ${formatImportProgressDiagnostics(latest)}; ${await readImportWizardDiagnostics(page)}`,
  );
}
