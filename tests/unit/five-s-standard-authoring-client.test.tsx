import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FiveSDiscardDraftControl,
  FiveSDraftAuthoringPanels,
} from "@/components/five-s/five-s-standard-authoring-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/platform/5s/standards/test",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/modules/billing/module-write-context", () => ({
  usePlanModuleWriteAllowed: () => true,
}));

const removeQuestion = vi.fn();
const removeSection = vi.fn();
const discardDraft = vi.fn();

vi.mock("@/app/(platform)/platform/5s/actions", () => ({
  addFiveSQuestionFromForm: vi.fn(),
  addFiveSSectionFromForm: vi.fn(),
  removeFiveSQuestionFromForm: async (...args: unknown[]) => {
    await removeQuestion(...args);
  },
  removeFiveSSectionFromForm: async (...args: unknown[]) => {
    await removeSection(...args);
  },
  discardFiveSStandardDraftFromForm: async (...args: unknown[]) => {
    await discardDraft(...args);
  },
  setFiveSStandardApplicableUnitsFromForm: vi.fn(),
  setFiveSStandardScoringScaleFromForm: vi.fn(),
}));

describe("FiveSDraftAuthoringPanels structural controls", () => {
  afterEach(() => {
    cleanup();
    removeQuestion.mockReset();
    removeSection.mockReset();
    discardDraft.mockReset();
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("639px"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("opens confirm dialogs for question and category removal", async () => {
    render(
      <FiveSDraftAuthoringPanels
        standardId="standard-1"
        versionId="version-1"
        sections={[
          {
            id: "section-a",
            title: "Sort",
            questions: [
              {
                id: "question-1",
                prompt: "Is it tidy?",
                questionType: "yes_no",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByTestId("five-s-remove-question-open-question-1"),
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("five-s-remove-structural-dialog"),
      ).toBeVisible();
    });
    expect(screen.getByText(/Remove question\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByTestId("five-s-remove-structural-dialog"),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("five-s-remove-section-open-section-a"));
    await waitFor(() => {
      expect(screen.getByText(/Remove category\?/)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Remove category" }),
    ).toBeInTheDocument();
  });

  it("submits question removal from the confirm dialog", async () => {
    render(
      <FiveSDraftAuthoringPanels
        standardId="standard-1"
        versionId="version-1"
        sections={[
          {
            id: "section-a",
            title: "Sort",
            questions: [
              {
                id: "question-1",
                prompt: "Is it tidy?",
                questionType: "yes_no",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByTestId("five-s-remove-question-open-question-1"),
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("five-s-remove-structural-confirm"),
      ).toBeVisible();
    });
    fireEvent.click(screen.getByTestId("five-s-remove-structural-confirm"));

    await waitFor(() => {
      expect(removeQuestion).toHaveBeenCalledTimes(1);
    });
  });

  it("shows remove errors and keeps the dialog open when the action rejects", async () => {
    removeQuestion.mockRejectedValueOnce(
      new Error("5S question is not removable"),
    );

    render(
      <FiveSDraftAuthoringPanels
        standardId="standard-1"
        versionId="version-1"
        sections={[
          {
            id: "section-a",
            title: "Sort",
            questions: [
              {
                id: "question-1",
                prompt: "Is it tidy?",
                questionType: "yes_no",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByTestId("five-s-remove-question-open-question-1"),
    );
    fireEvent.click(screen.getByTestId("five-s-remove-structural-confirm"));

    await waitFor(() => {
      expect(removeQuestion).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByTestId("five-s-remove-structural-error"),
    ).toHaveTextContent("5S question is not removable");
    expect(screen.getByTestId("five-s-remove-structural-dialog")).toBeVisible();
  });

  it("exposes discard draft with a destructive confirm and submit", async () => {
    render(
      <FiveSDiscardDraftControl standardId="standard-1" versionId="draft-1" />,
    );

    fireEvent.click(screen.getByTestId("five-s-discard-draft-open"));
    await waitFor(() => {
      expect(screen.getByTestId("five-s-discard-draft-dialog")).toBeVisible();
    });
    expect(screen.getByText(/Discard draft\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("five-s-discard-draft-confirm"));
    await waitFor(() => {
      expect(discardDraft).toHaveBeenCalledTimes(1);
    });
  });
});
