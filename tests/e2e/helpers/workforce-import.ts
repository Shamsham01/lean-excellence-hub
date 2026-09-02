import { type Page } from "@playwright/test";

import { mapWorkforceImportProgressFromDatabase } from "@/modules/workforce-import/constants";

import { createDemoAdminSession } from "./workforce-provisioning";

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

export async function queryWorkforceImportJobProgress(
  jobId: string,
): Promise<WorkforceImportJobProgress | null> {
  const { client } = await createDemoAdminSession();
  const { data, error } = await client.rpc(
    "get_workforce_import_job_progress",
    {
      target_import_job_id: jobId,
    },
  );

  if (error) {
    throw new Error(
      `get_workforce_import_job_progress RPC failed for jobId=${jobId} (code=${error.code ?? "unknown"}): ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return mapRpcProgress(jobId, data as Record<string, unknown>);
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
