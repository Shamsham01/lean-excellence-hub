import { describe, expect, it } from "vitest";

import {
  benefitSourceDisplayLabel,
  benefitSourceHref,
} from "@/lib/benefits/source";
import type { BenefitSourceLinkSummary } from "@/lib/benefits/types";
import {
  hasExactlyOneActiveOwner,
  isCharterReady,
  missingCharterRequirements,
} from "@/lib/projects/charter";
import { mapProjectMutationError } from "@/lib/projects/errors";
import { formatProjectReference } from "@/lib/projects/status";

describe("project charter readiness", () => {
  it("lists specific missing submit requirements", () => {
    expect(
      missingCharterRequirements({
        title: "Changeover",
        problemStatement: "",
        objective: null,
        methodologyVersionId: null,
        hasActiveOwner: false,
      }).map((requirement) => requirement.key),
    ).toEqual(["problem", "objective", "methodology", "owner"]);
  });

  it("is ready only when required charter content and owner are present", () => {
    expect(
      isCharterReady({
        title: "Changeover",
        problemStatement: "Too slow",
        objective: "Cut time",
        methodologyVersionId: "11111111-1111-4111-8111-111111111111",
        hasActiveOwner: true,
      }),
    ).toBe(true);
  });

  it("counts exactly one active owner", () => {
    expect(
      hasExactlyOneActiveOwner([
        { team_role: "owner", valid_to: null },
        { team_role: "member", valid_to: null },
      ]),
    ).toBe(true);
    expect(
      hasExactlyOneActiveOwner([
        { team_role: "owner", valid_to: "2026-01-01T00:00:00.000Z" },
        { team_role: "sponsor", valid_to: null },
      ]),
    ).toBe(false);
  });
});

describe("project references and mutation errors", () => {
  it("uses the project number as the human-readable reference", () => {
    expect(formatProjectReference("PROJ-2026-0004", "Changeover")).toBe(
      "PROJ-2026-0004",
    );
    expect(formatProjectReference(null, "Changeover")).toBe("Changeover");
  });

  it("maps incomplete charter failures to a field-level product message", () => {
    expect(
      mapProjectMutationError({
        code: "22023",
        message:
          "project charter is incomplete: problem statement, methodology",
      }),
    ).toBe("Charter is incomplete: problem statement, methodology.");
  });

  it("does not leak SQLSTATE or UUID details", () => {
    expect(
      mapProjectMutationError({
        code: "42501",
        message: "42501 uuid 11111111-1111-4111-8111-111111111111",
      }),
    ).toBe("You do not have permission to change this project.");
  });
});

describe("benefit source lineage display", () => {
  const projectLink: BenefitSourceLinkSummary = {
    source_resource_id: "11111111-1111-4111-8111-111111111111",
    resource_type: "ci_project",
    relationship_role: "primary",
    display_label: "PROJ-2026-0004",
    title: "Changeover Reduction",
    href: "/platform/projects/11111111-1111-4111-8111-111111111111",
  };

  it("prefers a human-readable project number over a raw UUID", () => {
    expect(benefitSourceDisplayLabel(projectLink)).toBe("PROJ-2026-0004");
    expect(benefitSourceDisplayLabel(projectLink)).not.toMatch(
      /11111111-1111-4111-8111-111111111111/,
    );
  });

  it("only exposes a project href when the server granted one", () => {
    expect(benefitSourceHref(projectLink)).toBe(
      "/platform/projects/11111111-1111-4111-8111-111111111111",
    );
    expect(
      benefitSourceHref({
        ...projectLink,
        href: null,
      }),
    ).toBeNull();
  });
});
