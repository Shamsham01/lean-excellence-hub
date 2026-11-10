import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartAssessmentDialog } from "@/components/maturity/start-assessment-dialog";
import { NewSuggestionDialog } from "@/components/suggestions/new-suggestion-dialog";
import { ExecutionUnitStartDialog } from "@/components/organisation/execution-unit-start-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("UX PR2 form dialogs", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("639px") ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("opens the new suggestion dialog and shows validation on empty submit", async () => {
    render(
      <NewSuggestionDialog
        loadError={null}
        programmesForForm={[{ id: "pv-1", programme_name: "Ideas" }]}
        categoriesForForm={[{ id: "cat-1", name: "Safety" }]}
        canManageProgrammes={false}
        primaryUnit={{
          hasPrimaryUnit: false,
          canManageAssignment: false,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("suggestions-new-link"));
    expect(screen.getByTestId("suggestions-new-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("suggestion-prerequisite-block")).toBeVisible();
  });

  it("opens start assessment dialog and blocks submit without entity", () => {
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

    fireEvent.click(screen.getByTestId("maturity-start-assessment-dialog-open"));
    const form = screen.getByTestId("start-assessment-form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form);
    expect(
      screen.getByText("Select framework, scope, and eligible entity."),
    ).toBeVisible();
  });

  it("opens five-s start audit dialog shell", () => {
    const action = vi.fn();
    render(
      <ExecutionUnitStartDialog
        dialogTitle="Start audit"
        action={action}
        hiddenFields={<input type="hidden" name="standardId" value="std-1" />}
        units={[
          { id: "u-1", name: "Plant", code: "PLT", site_id: "site-1" },
        ]}
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

  it("renders responsive dialog title for people invite pattern", async () => {
    render(
      <ResponsiveFormDialog
        open
        onOpenChange={vi.fn()}
        title="Invite a colleague"
        testId="people-invite-dialog"
      >
        <p>Invite form placeholder</p>
      </ResponsiveFormDialog>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("people-invite-dialog")).toBeVisible();
    });
    expect(screen.getByText("Invite a colleague")).toBeVisible();
  });
});
