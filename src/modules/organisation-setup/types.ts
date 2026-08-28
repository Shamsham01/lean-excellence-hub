export type SetupItemStatus =
  "not_started" | "in_progress" | "setup_started" | "complete" | "unavailable";

export type SetupTier = "core" | "recommended";

export type SetupItemId =
  | "organisation_identity"
  | "organisation_administrator"
  | "operational_unit"
  | "expand_structure"
  | "invite_team"
  | "roles_access"
  | "job_functions"
  | "lean_configuration"
  | "training_configuration";

export type SetupItem = {
  id: SetupItemId;
  tier: SetupTier;
  title: string;
  description: string;
  status: SetupItemStatus;
  canAssess: boolean;
  canPerform: boolean;
  href?: string;
  helperMessage?: string | undefined;
};

export type CoreSetupState = {
  items: SetupItem[];
  allComplete: boolean;
  canAssessAll: boolean;
  readyLabel: "ready" | "in_progress" | "managed_by_admin";
};

export type RecommendedSetupState = {
  items: SetupItem[];
};

export type OrganisationSetupSnapshot = {
  organisationName: string;
  organisationCode: string | null;
  core: CoreSetupState;
  recommended: RecommendedSetupState;
  nextActionHref: string | null;
  nextActionLabel: string | null;
};

export type SetupQueryResult = {
  organisationStatus: string | null;
  organisationName: string | null;
  organisationCode: string | null;
  activeUnitCount: number | null;
  activeUnitCountUnavailable: boolean;
  hasOrganisationOwner: boolean | null;
  ownerCheckUnavailable: boolean;
  activeMembershipCount: number | null;
  membershipCountUnavailable: boolean;
  pendingInvitationCount: number | null;
  pendingInvitationsUnavailable: boolean;
  nonOwnerGrantCount: number | null;
  grantsCheckUnavailable: boolean;
  customRoleWithoutGrant: boolean | null;
  customRolesCheckUnavailable: boolean;
  activeJobFunctionCount: number | null;
  jobFunctionsUnavailable: boolean;
  jobFunctionAssignmentCount: number | null;
  jobFunctionAssignmentsUnavailable: boolean;
  leanConfigSignalCount: number | null;
  leanConfigUnavailable: boolean;
  trainingCatalogCount: number | null;
  trainingCatalogUnavailable: boolean;
  hasChildUnits: boolean | null;
  childUnitsUnavailable: boolean;
};

export type SetupPermissionSnapshot = {
  canManageHierarchy: boolean;
  canManageHierarchyAtOrgScope: boolean;
  canManageInvitations: boolean;
  canReadRoles: boolean;
  canManageJobFunctions: boolean;
  canReadJobFunctions: boolean;
  canManageTraining: boolean;
  canReadTraining: boolean;
  canReadHierarchy: boolean;
  canReadMemberships: boolean;
  canManageProjects: boolean;
};

export type QuickAction = {
  label: string;
  href: string;
  description: string;
};
