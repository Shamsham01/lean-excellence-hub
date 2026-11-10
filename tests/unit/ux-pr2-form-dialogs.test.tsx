import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartAssessmentDialog } from "@/components/maturity/start-assessment-dialog";
import { NewSuggestionDialog } from "@/components/suggestions/new-suggestion-dialog";
import { ExecutionUnitStartDialog } from "@/components/organisation/execution-unit-start-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: vi.fn(),
}));

vi.mock("@/platform/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === "get_available_suggestion_submission_configuration") {
        return {
          data: {
            programmes: [
              {
                programme_version_id: "pv-1",
                programme_name: "Ideas",
              },
            ],
            categories: [{ category_id: "cat-1", category_name: "Safety" }],
          },
          error: null,
        };
      }
      if (fn === "get_current_membership_primary_unit") {
        return {
          data: { has_primary_unit: false },
          error: null,
        };
      }
      if (fn === "list_maturity_assessment_scope_entities") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    }),
  }),
}));

describe("UX PR2 form dialogs", () => {
afterEach(() => {
  cleanup();
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

  it("opens the new suggestion dialog and loads configuration on demand", async () => {
    render(
      <NewSuggestionDialog
        canManageProgrammes={false}
        canManageJobFunctions={false}
      />,
    );

    fireEvent.click(screen.getByTestId("suggestions-new-link"));
    await waitFor(() => {
      expect(screen.getByTestId("suggestions-new-dialog")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-prerequisite-block")).toBeVisible();
    });
  });

  it("opens start assessment dialog shell", () => {
    render(
      <StartAssessmentDialog
        versions={[
          {
            id: "ver-1",
            version_number: 1,
            display_name: "LEH",
            scope_types: ["site"],
          },
        ]}
        people={[{ id: "person-1", label: "Alex Admin" }]}
      />,
    );

    fireEvent.click(
      screen.getByTestId("maturity-start-assessment-dialog-open"),
    );
    expect(screen.getByTestId("start-assessment-form")).toBeInTheDocument();
  });

  it("opens five-s start audit dialog shell", () => {
    const action = vi.fn();
    render(
      <ExecutionUnitStartDialog
        dialogTitle="Start audit"
        action={action}
        hiddenFields={<input type="hidden" name="standardId" value="std-1" />}
        units={[{ id: "u-1", name: "Plant" }]}
        requiresSiteSelection={false}
        unitFieldId="unit"
        label="Unit"
        submitLabel="Start audit"
        emptyMessage="No units"
        formTestId="five-s-start-audit-form"
        unitSelectTestId="five-s-unit-select"
        submitTestId="five-s-start-audit"
      />,
    );

    fireEvent.click(screen.getByTestId("five-s-start-audit-open"));
    expect(
      screen.getByTestId("five-s-start-audit-form-dialog"),
    ).toBeInTheDocument();
  });

  it("blocks start audit when a concrete site is required", () => {
    const action = vi.fn();
    render(
      <ExecutionUnitStartDialog
        dialogTitle="Start audit"
        action={action}
        hiddenFields={<input type="hidden" name="standardId" value="std-1" />}
        units={[{ id: "u-1", name: "Packing" }]}
        requiresSiteSelection
        unitFieldId="unit"
        label="Unit"
        submitLabel="Start audit"
        emptyMessage="Select an active site in the sidebar before starting an audit."
        formTestId="five-s-start-audit-form"
        unitSelectTestId="five-s-unit-select"
        submitTestId="five-s-start-audit"
      />,
    );

    expect(screen.getByTestId("five-s-start-audit-open")).toBeDisabled();
    expect(screen.getByTestId("site-context-required")).toHaveTextContent(
      "Select an active site in the sidebar before starting an audit.",
    );
  });

  it("renders mobile sheet when matchMedia reports a narrow viewport", async () => {
    render(
      <ResponsiveFormDialog
        open
        onOpenChange={vi.fn()}
        title="Mobile sheet dialog"
        testId="mobile-sheet-dialog"
      >
        <p>Sheet body</p>
      </ResponsiveFormDialog>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("mobile-sheet-dialog")).toBeVisible();
    });
    expect(screen.getByText("Mobile sheet dialog")).toBeVisible();
  });

  it("announces labelled title and linked description", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(
      <ResponsiveFormDialog
        open
        onOpenChange={vi.fn()}
        title="Create scale"
        description="Name the scale before editing levels."
        testId="scale-create-test"
      >
        <p role="alert">Name is required</p>
      </ResponsiveFormDialog>,
    );
    expect(screen.getByText("Create scale")).toBeVisible();
    expect(
      screen.getByText("Name the scale before editing levels."),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });

  it("opens responsive dialog from a trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="open-responsive-dialog"
            onClick={() => setOpen(true)}
          >
            Open
          </button>
          <ResponsiveFormDialog
            open={open}
            onOpenChange={setOpen}
            title="Focused dialog"
            testId="focus-dialog"
          >
            <input data-testid="focus-target" />
          </ResponsiveFormDialog>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByTestId("open-responsive-dialog"));
    await waitFor(() =>
      expect(screen.getByTestId("focus-dialog")).toBeVisible(),
    );
  });
});
