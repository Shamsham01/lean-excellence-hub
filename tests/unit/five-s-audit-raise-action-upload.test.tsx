import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiveSAuditRaiseAction } from "@/components/five-s/five-s-audit-raise-action";
import {
  createFiveSPlannerAction,
  loadActionCreateContext,
} from "@/app/(platform)/platform/actions/actions";
import { uploadEvidenceFileClient } from "@/lib/attachments/upload-evidence-client";

vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadActionCreateContext: vi.fn(),
  createPlannerAction: vi.fn(),
  createFiveSPlannerAction: vi.fn(),
  initiateActionEvidenceUpload: vi.fn(),
  confirmActionEvidenceUpload: vi.fn(),
}));

vi.mock("@/lib/attachments/upload-evidence-client", () => ({
  uploadEvidenceFileClient: vi.fn(),
}));

const linkContext = {
  auditId: "audit-1",
  sectionId: "section-1",
  questionId: "question-1",
  defaultTitle: "Clear the walkway",
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(loadActionCreateContext).mockResolvedValue({
    labels: [],
    assignablePeople: [],
    canManageLabels: false,
  });
  vi.mocked(createFiveSPlannerAction).mockResolvedValue({
    ok: true,
    id: "action-five-s",
  });
  vi.mocked(uploadEvidenceFileClient).mockResolvedValue({
    ok: false,
    error: "storage failed",
  });
});

describe("FiveSAuditRaiseAction evidence upload failures", () => {
  it("keeps the dialog open with retry UI and bumps the count after persist", async () => {
    const onActionCreated = vi.fn();
    render(
      <FiveSAuditRaiseAction
        linkContext={linkContext}
        actionCount={1}
        onActionCreated={onActionCreated}
      />,
    );

    fireEvent.click(screen.getByTestId("five-s-raise-action"));
    expect(screen.getByTestId("actions-create-dialog")).toBeVisible();

    const dialog = screen.getByTestId("actions-create-dialog");
    fireEvent.change(screen.getByTestId("action-create-evidence-file"), {
      target: {
        files: [new File(["pixels"], "audit.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.submit(within(dialog).getByTestId("actions-create-form"));

    await waitFor(() => {
      expect(createFiveSPlannerAction).toHaveBeenCalledTimes(1);
      expect(onActionCreated).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("actions-create-dialog")).toBeVisible();
    expect(screen.getByTestId("actions-create-submit")).toHaveTextContent(
      /Retry upload/i,
    );
    expect(
      within(dialog).getByText(
        /One or more attachments could not be uploaded/i,
      ),
    ).toBeVisible();
  });
});
