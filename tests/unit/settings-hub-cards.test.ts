import { describe, expect, it } from "vitest";

import {
  buildSettingsHubCards,
  canAccessPeopleSettings,
  type SettingsHubCardAccess,
} from "@/modules/settings/settings-hub-cards";

const financeValidatorAccess: SettingsHubCardAccess = {
  canReadHierarchy: true,
  canReadJobFunctions: false,
  canManageAiAtOrgScope: false,
  canManageInvitations: false,
  canProvisionWorkforce: false,
  canImportWorkforce: false,
  canDelegateAccess: false,
};

const teamMemberAccess: SettingsHubCardAccess = {
  canReadHierarchy: true,
  canReadJobFunctions: false,
  canManageAiAtOrgScope: false,
  canManageInvitations: false,
  canProvisionWorkforce: false,
  canImportWorkforce: false,
  canDelegateAccess: false,
};

const adminAccess: SettingsHubCardAccess = {
  canReadHierarchy: true,
  canReadJobFunctions: true,
  canManageAiAtOrgScope: true,
  canManageInvitations: true,
  canProvisionWorkforce: true,
  canImportWorkforce: true,
  canDelegateAccess: true,
};

function cardAvailability(
  access: SettingsHubCardAccess,
  title: string,
): boolean {
  return (
    buildSettingsHubCards(access).find((card) => card.title === title)
      ?.available ?? false
  );
}

describe("settings hub card access", () => {
  it("always exposes profile self-service", () => {
    expect(cardAvailability(financeValidatorAccess, "Your profile")).toBe(true);
    expect(cardAvailability(teamMemberAccess, "Your profile")).toBe(true);
  });

  it("hides people administration for finance validator", () => {
    expect(canAccessPeopleSettings(financeValidatorAccess)).toBe(false);
    expect(
      cardAvailability(financeValidatorAccess, "People and invitations"),
    ).toBe(false);
  });

  it("shows organisation and structure when hierarchy.read is granted", () => {
    expect(cardAvailability(financeValidatorAccess, "Organisation")).toBe(true);
    expect(
      cardAvailability(financeValidatorAccess, "Organisation structure"),
    ).toBe(true);
  });

  it("keeps admin cards available for organisation administrators", () => {
    expect(cardAvailability(adminAccess, "People and invitations")).toBe(true);
    expect(cardAvailability(adminAccess, "Job functions")).toBe(true);
    expect(cardAvailability(adminAccess, "Lean AI")).toBe(true);
  });

  it("hides organisation cards without hierarchy.read", () => {
    const noHierarchyAccess = {
      ...teamMemberAccess,
      canReadHierarchy: false,
    };

    expect(cardAvailability(noHierarchyAccess, "Organisation")).toBe(false);
    expect(cardAvailability(noHierarchyAccess, "Organisation structure")).toBe(
      false,
    );
  });
});
