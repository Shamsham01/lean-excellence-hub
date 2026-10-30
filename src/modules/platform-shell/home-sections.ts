export type HomeAccess = {
  canReadMaturity: boolean;
  canManageMaturity: boolean;
  canReadActions: boolean;
  canReadFiveS: boolean;
  canReadGemba: boolean;
  canReadTemplates: boolean;
  canReadPeople: boolean;
  canReadCapability: boolean;
  canReadSuggestions: boolean;
  canSubmitSuggestions: boolean;
  canReadBenefits: boolean;
  canViewWorkplace: boolean;
};

export type HomeVisibility = {
  maturityMetric: boolean;
  actionsMetric: boolean;
  assessmentMetric: boolean;
  fiveSMetric: boolean;
  gembaMetric: boolean;
  capability: boolean;
  templates: boolean;
  suggestions: boolean;
  benefits: boolean;
  fiveSCard: boolean;
  gembaCard: boolean;
  maturityCard: boolean;
  peopleCard: boolean;
  recentAssessments: boolean;
  workplaceActivity: boolean;
  yourProfile: boolean;
  submitSuggestion: boolean;
  fiveSViewingCopy: boolean;
  gembaViewingCopy: boolean;
  maturityViewingCopy: boolean;
};

export function visibleHomeSections(access: HomeAccess): HomeVisibility {
  const maturityOpen =
    access.canReadMaturity ||
    access.canManageMaturity ||
    access.canViewWorkplace;

  return {
    maturityMetric: access.canReadMaturity,
    actionsMetric: access.canReadActions,
    assessmentMetric: access.canReadMaturity,
    fiveSMetric: access.canReadFiveS,
    gembaMetric: access.canReadGemba,
    capability: access.canReadCapability,
    templates: access.canReadTemplates,
    suggestions: access.canReadSuggestions,
    benefits: access.canReadBenefits,
    fiveSCard: access.canReadFiveS || access.canViewWorkplace,
    gembaCard: access.canReadGemba || access.canViewWorkplace,
    maturityCard: maturityOpen,
    peopleCard: access.canReadPeople,
    recentAssessments: access.canReadMaturity,
    workplaceActivity:
      access.canViewWorkplace &&
      (!access.canReadActions || !access.canReadFiveS || !access.canReadGemba),
    yourProfile: true,
    submitSuggestion: access.canSubmitSuggestions,
    fiveSViewingCopy: access.canViewWorkplace && !access.canReadFiveS,
    gembaViewingCopy: access.canViewWorkplace && !access.canReadGemba,
    maturityViewingCopy:
      access.canViewWorkplace &&
      !access.canReadMaturity &&
      !access.canManageMaturity,
  };
}
