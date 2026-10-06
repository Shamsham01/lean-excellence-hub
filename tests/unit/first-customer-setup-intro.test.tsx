import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FirstCustomerSetupIntro } from "@/components/onboarding/first-customer-setup-intro";

describe("FirstCustomerSetupIntro", () => {
  afterEach(() => {
    cleanup();
  });
  it("keeps organisation and first site distinct for a multi-site founder", () => {
    render(
      <FirstCustomerSetupIntro
        organisationName="Acme Foods Ltd"
        firstSiteName="Plymouth Factory"
        multiSiteIntent="yes"
        canOpenRollout
      />,
    );

    expect(screen.getByTestId("first-customer-setup-intro")).toHaveTextContent(
      "Acme Foods Ltd",
    );
    expect(screen.getByTestId("first-customer-setup-intro")).toHaveTextContent(
      "Plymouth Factory",
    );
    expect(screen.getByTestId("first-customer-setup-intro")).toHaveTextContent(
      "Yes, part of a wider multi-site organisation",
    );
    expect(screen.getByTestId("setup-open-rollout")).toBeInTheDocument();
    expect(
      screen.queryByText(/tenant|RPC|scope_unit_id/i),
    ).not.toBeInTheDocument();
  });

  it("treats a missing legacy intent as not sure", () => {
    render(
      <FirstCustomerSetupIntro
        organisationName="North Mill Ltd"
        firstSiteName="Manchester Mill"
        multiSiteIntent={null}
        canOpenRollout={false}
      />,
    );

    expect(screen.getByText("Not sure yet")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-open-rollout")).not.toBeInTheDocument();
  });
});
