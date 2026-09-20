import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AwardRecognitionForm } from "@/components/recognition/award-recognition-form";

const navigateTo = vi.fn();
const awardRecognition = vi.fn();

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

vi.mock("@/app/(platform)/platform/recognition/actions", () => ({
  awardRecognition: (...args: unknown[]) => awardRecognition(...args),
}));

afterEach(() => {
  cleanup();
  navigateTo.mockReset();
  awardRecognition.mockReset();
});

const types = [{ id: "type-1", name: "Thank you" }];
const units = [{ id: "unit-1", name: "Operations" }];
const people = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Apex Operator",
    label: "Apex Operator (Operator)",
    placementUnitId: "unit-1",
  },
];

describe("award recognition form navigation", () => {
  it("opens the created award with navigateTo after submit", async () => {
    const awardId = "55555555-5555-4555-8555-555555555555";
    awardRecognition.mockResolvedValueOnce({ ok: true, id: awardId });

    render(
      <AwardRecognitionForm
        types={types}
        units={units}
        people={people}
        defaultUnitId="unit-1"
        defaultRecipientId={people[0]!.id}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Great Idea" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Thank you for the improvement." },
    });
    fireEvent.click(screen.getByTestId("award-recognition-submit"));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        `/platform/recognition/${awardId}`,
      );
    });
    expect(awardRecognition).toHaveBeenCalledTimes(1);
  });
});
