// VERIFY draft for PR #391 (Spec A): the validation dialog has no default
// method, blocks save until a canonical method is chosen, and sends the key.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordSkillValidation = vi.fn();
const recordSkillSelfAssessment = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/people/actions", () => ({
  recordSkillValidation: (...args: unknown[]) => recordSkillValidation(...args),
  recordSkillSelfAssessment: (...args: unknown[]) =>
    recordSkillSelfAssessment(...args),
  initiateSkillAssessmentEvidence: vi.fn(),
  confirmSkillAssessmentEvidence: vi.fn(),
}));

vi.mock("@/components/attachments/evidence-uploader", () => ({
  EvidenceUploader: () => null,
}));

import { SkillAssessmentDialog } from "@/components/people/skill-assessment-dialog";

const props = {
  open: true,
  onOpenChange: vi.fn(),
  membershipId: "membership-1",
  displayName: "Ada Operator",
  gaps: [
    {
      skill_id: "skill-1",
      skill_name: "Forklift Operation",
      gap: {
        status: "not_assessed",
        target_order: 2,
        target_scale_version_id: "scale-version-1",
      },
    },
  ],
  levels: [
    {
      id: "level-1",
      order_value: 1,
      label: "Trained",
      scale_version_id: "scale-version-1",
    },
    {
      id: "level-2",
      order_value: 2,
      label: "To standard",
      scale_version_id: "scale-version-1",
    },
  ],
};

describe("SkillAssessmentDialog method selection", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    recordSkillValidation.mockReset();
    recordSkillSelfAssessment.mockReset();
    refresh.mockReset();
    recordSkillValidation.mockResolvedValue({ assessmentId: "assessment-1" });
  });

  it("opens with no method preselected and lists the five labels", () => {
    render(<SkillAssessmentDialog {...props} mode="validation" />);
    const select = screen.getByTestId(
      "skill-assessment-method",
    ) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Select method…",
      "Manager assessment",
      "Practical observation",
      "Qualification",
      "Trainer sign-off",
      "External certification",
    ]);
  });

  it("keeps save disabled until a method is chosen, then saves practical_observation", async () => {
    render(<SkillAssessmentDialog {...props} mode="validation" />);
    fireEvent.change(screen.getByTestId("skill-assessment-skill"), {
      target: { value: "skill-1" },
    });
    fireEvent.change(screen.getByTestId("skill-assessment-level"), {
      target: { value: "level-2" },
    });
    expect(screen.getByTestId("skill-assessment-save")).toBeDisabled();

    fireEvent.change(screen.getByTestId("skill-assessment-method"), {
      target: { value: "practical_observation" },
    });
    expect(screen.getByTestId("skill-assessment-save")).toBeEnabled();
    fireEvent.click(screen.getByTestId("skill-assessment-save"));

    await waitFor(() => expect(recordSkillValidation).toHaveBeenCalledTimes(1));
    expect(recordSkillValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: "membership-1",
        skillId: "skill-1",
        proficiencyLevelId: "level-2",
        assessmentMethod: "practical_observation",
      }),
    );
  });

  it("re-disables save when the placeholder is chosen again", () => {
    render(<SkillAssessmentDialog {...props} mode="validation" />);
    const method = screen.getByTestId("skill-assessment-method");
    fireEvent.change(method, { target: { value: "qualification" } });
    expect(screen.getByTestId("skill-assessment-save")).toBeEnabled();
    fireEvent.change(method, { target: { value: "" } });
    expect(screen.getByTestId("skill-assessment-save")).toBeDisabled();
  });

  it("self mode renders no method select and never sends a method", async () => {
    recordSkillSelfAssessment.mockResolvedValue({ assessmentId: "self-1" });
    render(<SkillAssessmentDialog {...props} mode="self" />);
    expect(screen.queryByTestId("skill-assessment-method")).toBeNull();
    fireEvent.change(screen.getByTestId("skill-assessment-skill"), {
      target: { value: "skill-1" },
    });
    fireEvent.change(screen.getByTestId("skill-assessment-level"), {
      target: { value: "level-1" },
    });
    fireEvent.click(screen.getByTestId("skill-assessment-save"));
    await waitFor(() =>
      expect(recordSkillSelfAssessment).toHaveBeenCalledTimes(1),
    );
    expect(recordSkillSelfAssessment.mock.calls[0][0]).not.toHaveProperty(
      "assessmentMethod",
    );
    expect(recordSkillValidation).not.toHaveBeenCalled();
  });
});
