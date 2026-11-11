import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/platform/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";

describe("PageHeader breadcrumb heading", () => {
  it("uses breadcrumb-only h1 for module titles without duplicating the name", () => {
    render(<PageHeader title="Actions" leanAiHelp={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Actions" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("keeps a contextual title when it differs from the breadcrumb trail", () => {
    render(
      <PageHeader
        title="Your profile"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Platform", href: "/platform" },
              { label: "Settings", href: "/platform/settings" },
              { label: "Profile" },
            ]}
          />
        }
        leanAiHelp={false}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Your profile" }),
    ).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });
});
