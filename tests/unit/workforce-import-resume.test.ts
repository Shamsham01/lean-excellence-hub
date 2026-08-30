import { describe, expect, it } from "vitest";

import {
  resolveImportJobHistoryAction,
  resolveImportWizardHydration,
} from "@/modules/workforce-import/resume";
import type { WorkforceImportProgress } from "@/modules/workforce-import/constants";

function progress(
  overrides: Partial<WorkforceImportProgress>,
): WorkforceImportProgress {
  return {
    status: "draft",
    totalRows: 10,
    validRows: 10,
    errorRows: 0,
    warningRows: 0,
    provisionedRows: 0,
    failedRows: 0,
    remediationRows: 0,
    remainingRows: 10,
    credentialExportStatus: "none",
    credentialExpiresAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("workforce import resume mapping", () => {
  it("maps draft jobs to validation step", () => {
    const hydration = resolveImportWizardHydration(
      progress({ status: "draft" }),
    );
    expect(hydration.step).toBe(1);
    expect(hydration.autoStartProvisioning).toBe(false);
  });

  it("maps validated jobs to review step", () => {
    const hydration = resolveImportWizardHydration(
      progress({ status: "validated", remainingRows: 10 }),
    );
    expect(hydration.step).toBe(2);
  });

  it("auto-resumes provisioning jobs with remaining rows", () => {
    const hydration = resolveImportWizardHydration(
      progress({
        status: "provisioning",
        provisionedRows: 4,
        remainingRows: 6,
      }),
    );
    expect(hydration.step).toBe(3);
    expect(hydration.autoStartProvisioning).toBe(true);
  });

  it("maps completed jobs with available credentials to download step", () => {
    const hydration = resolveImportWizardHydration(
      progress({
        status: "completed",
        remainingRows: 0,
        provisionedRows: 10,
        credentialExportStatus: "available",
      }),
    );
    expect(hydration.step).toBe(4);
    expect(hydration.credentialsAlreadyExported).toBe(false);
  });

  it("labels history actions for resumable states", () => {
    expect(
      resolveImportJobHistoryAction({
        id: "job-1",
        status: "provisioning",
        credential_export_status: "none",
      }).label,
    ).toBe("Resume provisioning");

    expect(
      resolveImportJobHistoryAction({
        id: "job-2",
        status: "completed",
        credential_export_status: "available",
      }).label,
    ).toBe("Download credentials");
  });
});
