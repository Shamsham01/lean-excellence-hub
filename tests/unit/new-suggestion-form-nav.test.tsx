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
const upload = vi.fn();

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

vi.mock("@/platform/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    rpc,
    storage: {
      from: () => ({
        upload,
      }),
    },
  }),
}));

afterEach(() => {
  cleanup();
  navigateTo.mockReset();
  rpc.mockReset();
  upload.mockReset();
});

const programmeVersions = [
  { id: "programme-version-1", programme_name: "Everyday ideas" },
];
const categories = [{ id: "category-1", name: "Quality" }];

function renderForm() {
  return render(
    <NewSuggestionForm
      programmeVersions={programmeVersions}
      categories={categories}
      canManageProgrammes={false}
      primaryUnit={{ hasPrimaryUnit: true, canManageAssignment: false }}
    />,
  );
}

function fillIdea() {
  fireEvent.change(screen.getByLabelText("What have you noticed?"), {
    target: { value: "Changeovers lose labels" },
  });
  fireEvent.change(screen.getByLabelText("What would you change?"), {
    target: { value: "Add a holder at the station" },
  });
}

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

    renderForm();
    fillIdea();
    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        `/platform/suggestions/${draftId}`,
      );
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("retains the draft and blocks submit when evidence upload fails", async () => {
    const draftId = "66666666-6666-4666-8666-666666666666";
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "create_suggestion_draft") {
        return { data: draftId, error: null };
      }
      if (fn === "initiate_attachment_upload") {
        return { error: { message: "attachment upload is not authorised" } };
      }
      return { error: null };
    });

    renderForm();
    fillIdea();
    const file = new File(["photo"], "floor.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("suggestion-evidence-file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-submit-error")).toHaveTextContent(
        "Some evidence could not be attached",
      );
    });
    expect(navigateTo).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith(
      "submit_suggestion",
      expect.anything(),
    );
    expect(screen.getByRole("button", { name: "Submit idea" })).toBeDisabled();
  });

  it("retries submit against the retained draft after a submission failure", async () => {
    const draftId = "77777777-7777-4777-8777-777777777777";
    let submitAttempts = 0;
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "create_suggestion_draft") {
        return { data: draftId, error: null };
      }
      if (fn === "update_suggestion_draft") {
        return { error: null };
      }
      if (fn === "submit_suggestion") {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          return { error: { message: "suggestion is not submittable" } };
        }
        return { error: null };
      }
      return { error: null };
    });

    renderForm();
    fillIdea();
    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-submit-error")).toBeVisible();
    });
    expect(navigateTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        `/platform/suggestions/${draftId}`,
      );
    });
    expect(
      rpc.mock.calls.filter(([fn]) => fn === "create_suggestion_draft"),
    ).toHaveLength(1);
    expect(
      rpc.mock.calls.filter(([fn]) => fn === "submit_suggestion"),
    ).toHaveLength(2);
  });

  it("ignores repeated submit clicks while a request is in flight", async () => {
    const draftId = "88888888-8888-4888-8888-888888888888";
    let releaseDraft:
      ((value: { data: string; error: null }) => void) | undefined;
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "create_suggestion_draft") {
        return new Promise<{ data: string; error: null }>((resolve) => {
          releaseDraft = resolve;
        });
      }
      return { data: draftId, error: null };
    });

    renderForm();
    fillIdea();
    fireEvent.click(screen.getByRole("button", { name: "Submit idea" }));
    fireEvent.click(screen.getByRole("button", { name: "Submitting…" }));

    expect(
      rpc.mock.calls.filter(([fn]) => fn === "create_suggestion_draft"),
    ).toHaveLength(1);
    releaseDraft?.({ data: draftId, error: null });

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        `/platform/suggestions/${draftId}`,
      );
    });
  });
});
