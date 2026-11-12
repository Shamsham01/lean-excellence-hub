import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { EvidenceUploader } from "@/components/attachments/evidence-uploader";

vi.mock("@/lib/attachments/upload-evidence-client", () => ({
  uploadEvidenceFileClient: vi
    .fn()
    .mockResolvedValue({ ok: true, attachmentId: "att-q1" }),
}));

afterEach(() => {
  cleanup();
});

function KeyedUploader() {
  const [questionId, setQuestionId] = useState("question-a");
  return (
    <div>
      <button
        type="button"
        onClick={() => setQuestionId("question-b")}
        data-testid="switch-question"
      >
        Switch question
      </button>
      <EvidenceUploader
        key={questionId}
        existingEvidence={[]}
        canEdit
        filter={(item) => item.question_id === questionId}
        createdItemExtras={{ question_id: questionId }}
        onInitiate={async () => ({
          attachmentId: "att-q1",
          storagePath: "org/att-q1",
        })}
        onConfirm={async () => ({})}
        onLink={async () => ({})}
      />
    </div>
  );
}

describe("EvidenceUploader per-question isolation", () => {
  it("clears in-flight upload UI when the question key changes", async () => {
    render(<KeyedUploader />);

    const file = new File(["hello"], "evidence.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("evidence-file-input"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByText("Evidence attached")).toBeVisible(),
    );

    fireEvent.click(screen.getByTestId("switch-question"));
    expect(screen.queryByText("Evidence attached")).not.toBeInTheDocument();
    expect(screen.queryByText("evidence.txt")).not.toBeInTheDocument();
  });
});
