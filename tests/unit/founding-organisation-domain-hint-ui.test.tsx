import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FoundingOrganisationDomainHint } from "@/components/onboarding/founding-organisation-domain-hint";

describe("FoundingOrganisationDomainHint", () => {
  afterEach(() => {
    cleanup();
  });

  it("warns about a possible existing organisation without naming a tenant", () => {
    render(<FoundingOrganisationDomainHint />);
    const hint = screen.getByTestId("founding-organisation-domain-hint");
    expect(hint).toHaveTextContent("ask your administrator for an invitation");
    expect(hint).not.toHaveTextContent("Acme");
    expect(hint).not.toHaveTextContent("organisation name");
  });
});
