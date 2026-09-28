import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EvidenceGallery,
  canAttemptEvidencePreview,
} from "@/components/attachments/evidence-gallery";
import {
  EvidenceUploader,
  evidenceMatchesQuestion,
} from "@/components/attachments/evidence-uploader";
import { createEvidenceObjectUrl } from "@/lib/attachments/download-evidence";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

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
  createObjectUrl.mockResolvedValue("blob:mock-evidence");
});

const imageItem = {
  id: "att-image",
  filename: "Worm NFT Design.webp",
  mime_type: "image/webp",
  byte_size: 2048,
  storage_object_path: "org/site/att-image",
};

const pdfItem = {
  id: "att-pdf",
  filename: "standard.pdf",
  mime_type: "application/pdf",
  byte_size: 4096,
  storage_object_path: "org/site/att-pdf",
};

const textItem = {
  id: "att-text",
  filename: "notes.txt",
  mime_type: "text/plain",
  byte_size: 128,
  storage_object_path: "org/site/att-text",
};

describe("EvidenceGallery", () => {
  it("renders image preview UI for authorised image MIME types", async () => {
    render(<EvidenceGallery items={[imageItem]} />);

    expect(screen.getByText("Worm NFT Design.webp")).toBeVisible();
    await waitFor(() => {
      expect(screen.getByTestId("evidence-preview-att-image")).toBeVisible();
    });
    expect(createObjectUrl).toHaveBeenCalledWith("org/site/att-image");
    expect(
      screen.getByAltText("Evidence photo: Worm NFT Design.webp"),
    ).toHaveAttribute("src", "blob:mock-evidence");
    fireEvent.click(screen.getByTestId("evidence-preview-att-image"));
    expect(screen.getByTestId("evidence-lightbox-att-image")).toBeVisible();
    expect(screen.getByTestId("evidence-download-att-image")).toBeVisible();
  });

  it("renders a file card for PDF and text evidence", () => {
    render(<EvidenceGallery items={[pdfItem, textItem]} />);

    expect(screen.getByTestId("evidence-file-card-att-pdf")).toBeVisible();
    expect(screen.getByTestId("evidence-file-card-att-text")).toBeVisible();
    expect(screen.getByText("standard.pdf")).toBeVisible();
    expect(screen.getByText("notes.txt")).toBeVisible();
    expect(
      screen.queryByTestId("evidence-preview-att-pdf"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("does not attempt a preview without authorised storage information", () => {
    render(
      <EvidenceGallery
        items={[
          {
            ...imageItem,
            storage_object_path: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Worm NFT Design.webp")).toBeVisible();
    expect(
      screen.queryByTestId("evidence-preview-att-image"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("evidence-file-card-att-image")).toBeVisible();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(
      canAttemptEvidencePreview({ ...imageItem, storage_object_path: null }),
    ).toBe(false);
  });

  it("still displays evidence in read-only mode", async () => {
    render(
      <EvidenceUploader
        existingEvidence={[imageItem, pdfItem]}
        canEdit={false}
        onInitiate={async () => ({})}
        onConfirm={async () => ({})}
        onLink={async () => ({})}
      />,
    );

    expect(screen.getByTestId("evidence-uploader")).toBeVisible();
    expect(screen.queryByTestId("evidence-file-input")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("evidence-preview-att-image")).toBeVisible();
    });
    expect(screen.getByText("standard.pdf")).toBeVisible();
  });
});

describe("evidenceMatchesQuestion", () => {
  it("keeps question-linked and criterion-level evidence visible", () => {
    expect(
      evidenceMatchesQuestion(
        { ...imageItem, question_id: "q-1", criterion_id: "c-1" },
        "q-1",
        "c-1",
      ),
    ).toBe(true);
    expect(
      evidenceMatchesQuestion(
        { ...imageItem, question_id: "q-2", criterion_id: "c-1" },
        "q-1",
        "c-1",
      ),
    ).toBe(false);
    expect(
      evidenceMatchesQuestion(
        { ...imageItem, question_id: null, criterion_id: "c-1" },
        "q-1",
        "c-1",
      ),
    ).toBe(true);
    expect(
      evidenceMatchesQuestion(
        { ...imageItem, question_id: null, criterion_id: "c-2" },
        "q-1",
        "c-1",
      ),
    ).toBe(false);
  });

  it("still displays matching evidence when the uploader is read-only", () => {
    render(
      <EvidenceUploader
        existingEvidence={[
          { ...imageItem, question_id: null, criterion_id: "c-1" },
        ]}
        canEdit={false}
        filter={(item) => evidenceMatchesQuestion(item, "q-1", "c-1")}
        onInitiate={async () => ({})}
        onConfirm={async () => ({})}
        onLink={async () => ({})}
      />,
    );

    expect(screen.getByText("Worm NFT Design.webp")).toBeVisible();
    expect(screen.getByTestId("evidence-gallery")).toBeVisible();
  });
});
