import { describe, expect, it } from "vitest";

import { explainSkillsQuestion } from "@/modules/leanai-context/product-knowledge/explain";
import {
  conversationUnavailableCopy,
  starterPromptsForAccess,
} from "@/modules/leanai-context/assistant/guidance-for-access";
import { visibleHomeSections } from "@/modules/platform-shell/home-sections";
import { buildQuickActions } from "@/modules/organisation-setup/readiness";
import type { SetupPermissionSnapshot } from "@/modules/organisation-setup/types";

const noAdmin: SetupPermissionSnapshot = {
  canManageHierarchy: false,
  canManageHierarchyAtOrgScope: false,
  canManageInvitations: false,
  canReadRoles: false,
  canManageJobFunctions: false,
  canReadJobFunctions: false,
  canManageTraining: false,
  canReadTraining: false,
  canReadHierarchy: false,
  canReadMemberships: false,
  canManageProjects: false,
  currentMembershipAdminHref: null,
};

const viewer = {
  canReadMaturity: false,
  canManageMaturity: false,
  canReadActions: false,
  canReadFiveS: false,
  canReadGemba: false,
  canReadTemplates: false,
  canReadPeople: false,
  canReadCapability: false,
  canReadSuggestions: false,
  canSubmitSuggestions: true,
  canReadBenefits: false,
  canViewWorkplace: true,
};

describe("employee access experience", () => {
  it("hides restricted home metrics for workplace viewing", () => {
    const home = visibleHomeSections(viewer);
    expect(home.capability).toBe(false);
    expect(home.benefits).toBe(false);
    expect(home.recentAssessments).toBe(false);
    expect(home.peopleCard).toBe(false);
    expect(home.workplaceActivity).toBe(true);
    expect(home.yourProfile).toBe(true);
    expect(home.submitSuggestion).toBe(true);
    expect(home.maturityViewingCopy).toBe(true);
  });

  it("keeps module metrics when the member can read them", () => {
    const home = visibleHomeSections({
      ...viewer,
      canReadActions: true,
      canReadFiveS: true,
      canReadGemba: true,
      canReadMaturity: true,
      canReadBenefits: true,
      canViewWorkplace: true,
    });
    expect(home.actionsMetric).toBe(true);
    expect(home.benefits).toBe(true);
    expect(home.workplaceActivity).toBe(true);
    expect(home.maturityViewingCopy).toBe(false);
  });

  it("does not offer maturity setup without authority to open it", () => {
    const labels = buildQuickActions(noAdmin, "hidden").map(
      (action) => action.label,
    );
    expect(labels).not.toContain("Start Lean maturity");
    expect(
      buildQuickActions(noAdmin, "view").map((action) => action.label),
    ).toContain("View maturity results");
    expect(
      buildQuickActions(noAdmin, "start").map((action) => action.label),
    ).toContain("Start Lean maturity");
  });

  it("removes administrator prompts from operator guidance", () => {
    expect(
      starterPromptsForAccess({
        prompts: ["Recommend a setup", "What is a programme?"],
        canAdministerPage: false,
      }),
    ).toEqual(["What is a programme?"]);
  });

  it("says conversation is not enabled when the member cannot use it", () => {
    expect(
      conversationUnavailableCopy({
        eligible: true,
        eligibilityMessage: null,
        applicationAvailable: true,
        organisationEnabled: true,
        canUseConversation: false,
      }),
    ).toMatch(/do not have permission to use LeanAI conversation/i);
  });

  it("explains access without treating a job function as a permission", () => {
    const answer = explainSkillsQuestion({
      question: "What does Your access show for Workplace Viewer?",
    });
    expect(answer.answer).toMatch(/job function does not grant/i);
    expect(answer.answer).toMatch(/Workplace Viewer/);
    expect(answer.answer).toMatch(/conversation is not enabled/i);
  });
});
