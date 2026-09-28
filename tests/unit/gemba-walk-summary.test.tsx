import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GembaWalkSummary } from "@/components/gemba/walk-summary";
import { createEvidenceObjectUrl } from "@/lib/attachments/download-evidence";

vi.mock("@/lib/attachments/download-evidence", () => ({
  createEvidenceObjectUrl: vi.fn(),
  downloadEvidenceObject: vi.fn(),
}));

const createObjectUrl = vi.mocked(createEvidenceObjectUrl);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  createObjectUrl.mockReset();
  createObjectUrl.mockResolvedValue("blob:mock-gemba-evidence");
});

describe("GembaWalkSummary evidence", () => {
  it("renders image evidence inline instead of filename-only copy", async () => {
    render(
      <GembaWalkSummary
        definitionName="Operations Gemba"
        unitName="Operations"
        status="completed"
        completedAt="2026-09-28T12:00:00.000Z"
        summaryNotes="Walk complete."
        sections={[
          {
            id: "section-1",
            title: "Operations floor",
            questions: [
              {
                id: "q-1",
                prompt: "What did you observe?",
                question_type: "long_text",
                help_text: null,
              },
            ],
          },
        ]}
        answers={{ "q-1": { text_value: "Labels drifting." } }}
        observations={[
          {
            id: "obs-1",
            observation_text: "Lane two labels are drifting.",
            observation_type: "improvement_opportunity",
          },
        ]}
        evidence={[
          {
            id: "att-1",
            filename: "Worm NFT Design.webp",
            mime_type: "image/webp",
            byte_size: 2048,
            storage_object_path: "org/site/att-1",
            observation_id: "obs-1",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("gemba-walk-summary")).toBeVisible();
    expect(
      screen.queryByText(/Evidence:\s*Worm NFT Design\.webp/),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("evidence-preview-att-1")).toBeVisible();
    });
    expect(screen.getByText("Worm NFT Design.webp")).toBeVisible();
  });
});
