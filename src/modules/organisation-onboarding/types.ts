export const STRUCTURE_FIRST_STEP_KEYS = [
  "organisation",
  "site",
  "structure",
  "job_functions",
  "people",
  "readiness",
] as const;

export type StructureFirstStepKey = (typeof STRUCTURE_FIRST_STEP_KEYS)[number];

export const STRUCTURE_FIRST_STEP_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
  "skipped",
] as const;

export type StructureFirstStepStatus =
  (typeof STRUCTURE_FIRST_STEP_STATUSES)[number];

export type StructureFirstStepState = {
  key: StructureFirstStepKey;
  title: string;
  status: StructureFirstStepStatus;
  skippable: boolean;
};

export type StructureFirstOnboardingEvent = {
  eventKey: "onboarding.step_completed" | "onboarding.step_skipped";
  stepKey: string;
  occurredAt: string;
};

export type StructureFirstFacts = {
  organisationName: string | null;
  organisationStatus: string | null;
  organisationLocale: string | null;
  organisationTimeZone: string | null;
  reportingCurrency: string | null;
  multiSiteIntent: string | null;
  billingPlanCode: string | null;
  billingPlanName: string | null;
  firstSiteName: string | null;
  firstSiteId: string | null;
  activeUnitCount: number;
  childUnitCount: number;
  activeJobFunctionCount: number;
  activeMembershipCount: number;
  pendingInvitationCount: number;
  ownerDisplayName: string | null;
  onboardingJourneyStarted: boolean;
  events: StructureFirstOnboardingEvent[];
};

export type StructureFirstProgress = {
  steps: StructureFirstStepState[];
  currentStep: StructureFirstStepKey;
  allFoundationReady: boolean;
};

export type StructureDraftUnit = {
  localId: string;
  name: string;
  unitType: string;
  children: StructureDraftUnit[];
};

export type JobFunctionSuggestion = {
  name: string;
  code: string;
  description: string;
};

export type ModuleHandoffCard = {
  key: string;
  title: string;
  href: string;
  why: string;
};

export type StructureFirstOwner = {
  membershipId: string;
  displayName: string;
};

export type StructureFirstMember = {
  membershipId: string;
  displayName: string;
};

export type StructureFirstPendingInvitation = {
  id: string;
  email: string;
  expiresAtLabel: string;
  roleName: string;
  scopeLabel: string;
};

export type StructureFirstJobFunction = {
  id: string;
  name: string;
  code: string;
  description: string | null;
};

export type StructureFirstPermissions = {
  canManageHierarchy: boolean;
  canCreateRoot: boolean;
  canManageJobFunctions: boolean;
  canManageInvitations: boolean;
  canDelegateRoles: boolean;
  canAskLeanAi: boolean;
};

export type StructureGuidance = {
  id: string;
  body: string;
};

export type StructureFirstSnapshotView = {
  facts: StructureFirstFacts;
  progress: StructureFirstProgress;
  visibleStep: StructureFirstStepKey;
  units: Array<{
    id: string;
    code: string;
    name: string;
    unit_type?: string;
    parent_unit_id?: string | null;
    status?: string;
  }>;
  tree: Array<{
    id: string;
    code: string;
    name: string;
    unitType: string;
    parentUnitId: string | null;
    children: StructureFirstSnapshotView["tree"];
  }>;
  jobFunctions: StructureFirstJobFunction[];
  members: StructureFirstMember[];
  owners: StructureFirstOwner[];
  pendingInvitations: StructureFirstPendingInvitation[];
  permissions: StructureFirstPermissions;
  guidance: StructureGuidance[];
  offers: unknown[];
};
