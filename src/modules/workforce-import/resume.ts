import type { WorkforceImportProgress } from "./constants";

export type ImportWizardStep = 0 | 1 | 2 | 3 | 4;

export type ImportJobHydration = {
  step: ImportWizardStep;
  autoStartProvisioning: boolean;
  credentialsAlreadyExported: boolean;
};

export type ImportJobHistoryAction = {
  label: string;
  href: string;
  testId: string;
};

export function importJobPath(jobId: string): string {
  return `/platform/settings/people/import/${jobId}`;
}

export function resolveImportWizardHydration(
  progress: WorkforceImportProgress,
): ImportJobHydration {
  switch (progress.status) {
    case "draft":
      return {
        step: 1,
        autoStartProvisioning: false,
        credentialsAlreadyExported: false,
      };
    case "validation_failed":
      return {
        step: 1,
        autoStartProvisioning: false,
        credentialsAlreadyExported: false,
      };
    case "validated":
      return {
        step: 2,
        autoStartProvisioning: false,
        credentialsAlreadyExported: false,
      };
    case "provisioning":
      if (progress.remainingRows > 0) {
        return {
          step: 3,
          autoStartProvisioning: true,
          credentialsAlreadyExported: false,
        };
      }
      return {
        step: 4,
        autoStartProvisioning: false,
        credentialsAlreadyExported:
          progress.credentialExportStatus === "exported",
      };
    case "completed":
    case "completed_with_remediation":
      return {
        step: 4,
        autoStartProvisioning: false,
        credentialsAlreadyExported:
          progress.credentialExportStatus === "exported",
      };
    case "failed":
    case "cancelled":
    default:
      return {
        step: 4,
        autoStartProvisioning: false,
        credentialsAlreadyExported:
          progress.credentialExportStatus === "exported",
      };
  }
}

export function resolveImportJobHistoryAction(input: {
  id: string;
  status: string;
  credential_export_status: string;
  remaining_rows?: number;
  remediation_rows?: number;
  failed_rows?: number;
}): ImportJobHistoryAction {
  const href = importJobPath(input.id);

  if (input.status === "draft") {
    return {
      label: "Resume validation",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if (input.status === "validation_failed") {
    return {
      label: "Resume validation",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if (input.status === "validated") {
    return {
      label: "Continue review",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if (input.status === "provisioning") {
    return {
      label: "Resume provisioning",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if (
    (input.status === "completed" ||
      input.status === "completed_with_remediation") &&
    input.credential_export_status === "available"
  ) {
    return {
      label: "Download credentials",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if (input.credential_export_status === "exported") {
    return {
      label: "View result",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if ((input.remediation_rows ?? 0) > 0) {
    return {
      label: "Review remediation",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  if ((input.failed_rows ?? 0) > 0) {
    return {
      label: "Review / Retry",
      href,
      testId: `import-job-action-${input.id}`,
    };
  }

  return {
    label: "View import",
    href,
    testId: `import-job-action-${input.id}`,
  };
}
