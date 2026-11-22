import { describe, expect, it } from "vitest";

import {
  hasActivePeopleDirectoryFilters,
  parsePeopleDirectorySearchParams,
  peopleDirectoryHref,
} from "@/lib/people/directory-query";
import {
  membershipStatusPresentation,
  peopleDirectoryContactLine,
  peopleDirectoryRoleLabel,
} from "@/lib/people/membership-status";

describe("people directory query", () => {
  it("parses filters from search params", () => {
    expect(
      parsePeopleDirectorySearchParams({
        q: " ada ",
        unit: "11111111-1111-4111-8111-111111111111",
        status: "pending",
        page: "2",
        pageSize: "10",
        includeInactive: "1",
      }),
    ).toEqual({
      q: "ada",
      unitId: "11111111-1111-4111-8111-111111111111",
      status: "pending",
      page: 2,
      pageSize: 10,
      includeInactive: true,
    });
  });

  it("builds hrefs and detects active filters", () => {
    const filters = parsePeopleDirectorySearchParams({ q: "lee" });
    expect(peopleDirectoryHref(filters)).toBe("/platform/people?q=lee");
    expect(hasActivePeopleDirectoryFilters(filters)).toBe(true);
    expect(hasActivePeopleDirectoryFilters({ ...filters, q: null })).toBe(
      false,
    );
  });
});

describe("people directory presentation", () => {
  it("maps membership statuses to LEH semantic pills", () => {
    expect(membershipStatusPresentation("active").variant).toBe("success");
    expect(membershipStatusPresentation("pending").label).toBe(
      "Invited / onboarding",
    );
    expect(membershipStatusPresentation("inactive").variant).toBe(
      "destructive",
    );
  });

  it("formats contact and role labels", () => {
    expect(
      peopleDirectoryContactLine({
        email: "person@example.com",
        notification_email: null,
        username: null,
      }),
    ).toBe("person@example.com");
    expect(
      peopleDirectoryContactLine({
        email: null,
        notification_email: "notify@example.com",
        username: null,
      }),
    ).toBe("notify@example.com");
    expect(
      peopleDirectoryContactLine({
        email: null,
        notification_email: null,
        username: "frontline.user",
        is_workforce_account: true,
      }),
    ).toBe("frontline.user");
    expect(
      peopleDirectoryRoleLabel({
        job_function_name: "Operator",
        job_title: "Team lead",
      }),
    ).toBe("Operator");
  });
});
