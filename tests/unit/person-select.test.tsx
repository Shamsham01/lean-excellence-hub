import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateBenefitWizard } from "@/components/benefits/create-benefit-wizard";
import { PersonSelect } from "@/components/people/person-select";
import { AwardRecognitionForm } from "@/components/recognition/award-recognition-form";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const people = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "CookieWorks Finance",
    label: "CookieWorks Finance (Finance Validator)",
    placementUnitId: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "CookieWorks Production Manager",
    label: "CookieWorks Production Manager (Production Manager · Operations)",
    placementUnitId: "bodmin-ops",
  },
];

describe("PersonSelect", () => {
  it("renders recognisable names and keeps membership ids internal", () => {
    render(
      <PersonSelect
        label="Owner"
        options={people}
        value={people[0]!.id}
        onChange={() => undefined}
      />,
    );

    expect(
      screen.getByRole("option", {
        name: "CookieWorks Finance (Finance Validator)",
      }),
    ).toHaveValue("11111111-1111-4111-8111-111111111111");
    expect(
      screen.queryByRole("option", {
        name: "11111111-1111-4111-8111-111111111111",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^11111111$/)).not.toBeInTheDocument();
  });
});

describe("Benefits owner selector", () => {
  it("renders recognisable people names rather than UUIDs", () => {
    render(
      <CreateBenefitWizard
        units={[{ id: "bodmin-packing", name: "Packing" }]}
        members={people}
        categories={[]}
      />,
    );

    const owner = screen.getByTestId("benefit-owner-select");
    expect(owner).toHaveTextContent("CookieWorks Finance");
    expect(owner).toHaveTextContent("CookieWorks Production Manager");
    expect(owner).not.toHaveTextContent("11111111-1111-4111-8111-111111111111");
    expect(owner).not.toHaveTextContent("22222222-2222-4222-8222-222222222222");
  });
});

describe("Recognition recipient selector", () => {
  it("renders recognisable recipient names rather than UUIDs", () => {
    render(
      <AwardRecognitionForm
        types={[{ id: "type-1", name: "Thank you" }]}
        units={[{ id: "bodmin-packing", name: "Packing" }]}
        people={people}
      />,
    );

    const recipient = screen.getByTestId("recognition-recipient-select");
    expect(recipient).toHaveTextContent("CookieWorks Finance");
    expect(recipient).not.toHaveTextContent(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(
      screen.queryByText("Recipient membership ID"),
    ).not.toBeInTheDocument();
  });
});
