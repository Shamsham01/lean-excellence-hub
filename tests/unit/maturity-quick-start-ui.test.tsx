import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaturityQuickStartCard } from "@/components/maturity/maturity-quick-start-card";
import { MaturityTemplatePreview } from "@/components/maturity/maturity-template-preview";
import { LEH_OPERATIONAL_EXCELLENCE_STANDARD } from "@/modules/maturity/templates";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  instantiateMaturityQuickStartTemplate: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("Maturity Quick Start UI", () => {
  it("shows the Operational Excellence card with counts and preview", () => {
    render(
      <MaturityQuickStartCard
        template={LEH_OPERATIONAL_EXCELLENCE_STANDARD}
        canManage
      />,
    );

    expect(screen.getByTestId("maturity-quick-start-card")).toHaveAttribute(
      "data-template-key",
      "leh-operational-excellence-standard",
    );
    expect(screen.getByText("LEH Quick Start")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(2);
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByTestId("preview-quick-start-template")).toHaveAttribute(
      "href",
      "/platform/maturity/templates/leh-operational-excellence-standard",
    );
    expect(screen.getByTestId("use-quick-start-template")).toBeInTheDocument();
  });

  it("hides deployment when the member cannot manage frameworks", () => {
    render(
      <MaturityTemplatePreview
        template={LEH_OPERATIONAL_EXCELLENCE_STANDARD}
        canManage={false}
      />,
    );

    expect(
      screen.getByTestId("maturity-template-preview-page"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("use-quick-start-template"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("template-preview-back-link")).toHaveAttribute(
      "href",
      "/platform/maturity/models",
    );
    expect(
      screen.getByTestId("template-preview-criterion-1-1"),
    ).toHaveTextContent("Daily Management");
  });
});
