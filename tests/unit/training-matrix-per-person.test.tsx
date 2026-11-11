// VERIFY (Spec B): TrainingMatrix marks required courses per person in the
// desktop table and mobile cards, not from a global required-course list.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrainingMatrix } from "@/components/training/training-matrix";

const memberships = [
  { id: "m-bodmin", display_name: "Bodmin Operator" },
  { id: "m-exeter", display_name: "Exeter Operator" },
];
const courses = [
  { id: "c-bodmin", name: "Bodmin allergen awareness" },
  { id: "c-all", name: "Site induction" },
  { id: "c-optional", name: "Optional refresher" },
];
const requirements = [
  { membership_id: "m-bodmin", course_id: "c-bodmin", mandatory: true },
  { membership_id: "m-bodmin", course_id: "c-all", mandatory: true },
  { membership_id: "m-exeter", course_id: "c-all", mandatory: true },
  { membership_id: "m-exeter", course_id: "c-optional", mandatory: false },
];
const future = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString();
const completions = [
  {
    membership_id: "m-exeter",
    course_id: "c-all",
    status: "completed",
    expires_at: future,
  },
];

function renderMatrix() {
  return render(
    <TrainingMatrix
      memberships={memberships}
      courses={courses}
      requirements={requirements}
      completions={completions}
    />,
  );
}

describe("TrainingMatrix per-person applicability", () => {
  afterEach(() => cleanup());

  it("renders without referencing removed globals (mobile branch included)", () => {
    expect(() => renderMatrix()).not.toThrow();
  });

  it("a site course is required for the Bodmin person only", () => {
    renderMatrix();
    expect(
      screen.getByLabelText(
        "Bodmin Operator — Bodmin allergen awareness: Required",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Exeter Operator — Bodmin allergen awareness: Not Required",
      ),
    ).toBeInTheDocument();
  });

  it("non-mandatory applicability renders as Not Required", () => {
    renderMatrix();
    expect(
      screen.getByLabelText(
        "Exeter Operator — Optional refresher: Not Required",
      ),
    ).toBeInTheDocument();
  });

  it("a valid completion on a required course shows Completed", () => {
    renderMatrix();
    expect(
      screen.getByLabelText("Exeter Operator — Site induction: Completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Bodmin Operator — Site induction: Required"),
    ).toBeInTheDocument();
  });

  it("mobile cards list only courses required for that person", () => {
    renderMatrix();
    const exeterCard = screen
      .getByTestId("training-matrix-person-card-m-exeter")
      .closest("div") as HTMLElement;
    expect(
      within(exeterCard).queryByText("Bodmin allergen awareness"),
    ).toBeNull();
    expect(within(exeterCard).getByText("Site induction")).toBeInTheDocument();
    const bodminCard = screen
      .getByTestId("training-matrix-person-card-m-bodmin")
      .closest("div") as HTMLElement;
    expect(
      within(bodminCard).getByText("Bodmin allergen awareness"),
    ).toBeInTheDocument();
  });
});
