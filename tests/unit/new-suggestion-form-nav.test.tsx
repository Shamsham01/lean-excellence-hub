import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";

const navigateTo = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

vi.mock("@/platform/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

afterEach(() => {
  cleanup();
  navigateTo.mockReset();
  rpc.mockReset();
});

const programmeVersions = [
  { id: "programme-version-1", programme_name: "Everyday ideas" },
];
const categories = [{ id: "category-1", name: "Quality" }];

describe("new suggestion form navigation", () => {
  it("exposes a programmes configuration AppLink when catalogues are missing", () => {
    render(
      <NewSuggestionForm
        programmeVersions={[]}
        categories={[]}
        canManageProgrammes
        primaryUnit={{ hasPrimaryUnit: true, canManageAssignment: false }}
      />,
    );

    const link = screen.getByTestId("suggestion-configure-programmes-link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/platform/suggestions/programmes");
    expect(link).toHaveTextContent("Configure suggestion programmes");
  });

  it("exposes a work-area AppLink when the primary assignment is missing", () => {
    render(
      <NewSuggestionForm
        programmeVersions={programmeVersions}
        categories={categories}
        canManageProgrammes={false}
        primaryUnit={{
          hasPrimaryUnit: false,
          canManageAssignment: true,
          membershipId: "44444444-4444-4444-8444-444444444444",
        }}
      />,
    );

    const link = screen.getByTestId("suggestion-assign-work-area-link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute(
      "href",
      "/platform/people/44444444-4444-4444-8444-444444444444/admin",
    );
  });

  it("opens the created suggestion with navigateTo after submit", async () => {
    const draftId = "55555555-5555-4555-8555-555555555555";
    rpc
      .mockResolvedValueOnce({ data: draftId, error: null })
      .mockResolvedValueOnce({ error: null });

    render(
      <NewSuggestionForm
        programmeVersions={programmeVersions}
        categories={categories}
        canManageProgrammes={false}
        primaryUnit={{ hasPrimaryUnit: true, canManageAssignment: false }}
      />,
    );

    fireEvent.change(screen.getByLabelText("What have you noticed?"), {
      target: { value: "Changeovers lose labels" },
    });
    fireEvent.change(screen.getByLabelText("What would you change?"), {
      target: { value: "Add a holder at the station" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        `/platform/suggestions/${draftId}`,
      );
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
