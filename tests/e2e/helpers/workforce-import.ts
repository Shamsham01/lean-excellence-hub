import { expect, type Page } from "@playwright/test";

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

export async function uploadWorkforceImportCsv(
  page: Page,
  input: { filename: string; csvContent: string },
): Promise<void> {
  await page.getByTestId("workforce-import-file").setInputFiles({
    name: input.filename,
    mimeType: "text/csv",
    buffer: Buffer.from(input.csvContent),
  });
  await expect(page.getByTestId("workforce-import-wizard")).toHaveAttribute(
    "data-wizard-ready",
    "true",
    { timeout: 180_000 },
  );
  await expect(page.getByText(/rows detected/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("validate-import")).toBeVisible({
    timeout: 30_000,
  });
  const importMessage = page.getByTestId("import-message");
  const message = (await importMessage.textContent().catch(() => null))?.trim();
  if (message) {
    throw new Error(
      `Workforce import file upload failed: ${message}. ${await readImportWizardDiagnostics(page)}`,
    );
  }
}

export async function validateWorkforceImportAndStartProvisioning(
  page: Page,
): Promise<void> {
  const start = page.getByTestId("start-import-provisioning");
  const errorSurface = page.getByTestId("import-message");
  const validateButton = page.getByTestId("validate-import");
  const onReview = await start.isVisible().catch(() => false);
  if (!onReview && (await validateButton.isVisible().catch(() => false))) {
    await expect(validateButton).toBeEnabled({ timeout: 30_000 });
    const obscured = await validateButton.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const center = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return center !== button && !button.contains(center);
    });
    if (obscured) {
      throw new Error(
        `Validate import control is covered by another element. ${await readImportWizardDiagnostics(page)}`,
      );
    }
    await validateButton.evaluate((button: HTMLButtonElement) => {
      button.click();
    });
  }

  try {
    await expect(start.or(errorSurface)).toBeVisible({ timeout: 120_000 });
  } catch {
    throw new Error(
      `Workforce import validation did not advance. ${await readImportWizardDiagnostics(page)}`,
    );
  }
  const errorText = (await errorSurface.textContent())?.trim();
  if (errorText) {
    throw new Error(
      `Workforce import validation blocked provisioning: ${errorText}. ${await readImportWizardDiagnostics(page)}`,
    );
  }
  await expect(start).toBeEnabled({ timeout: 60_000 });
  await start.evaluate((button: HTMLButtonElement) => {
    button.click();
  });
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
