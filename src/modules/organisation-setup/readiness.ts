import type {
  CoreSetupState,
  OrganisationSetupSnapshot,
  RecommendedSetupState,
  SetupItem,
  SetupItemStatus,
  SetupPermissionSnapshot,
  SetupQueryResult,
} from "./types";

export function setupStatusLabel(status: SetupItemStatus) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "setup_started":
      return "Setup started";
    case "complete":
      return "Complete";
    case "unavailable":
      return "Unavailable";
  }
}

function adminHelper(canPerform: boolean, isAdmin = false) {
  if (canPerform) {
    return undefined;
  }
  if (isAdmin) {
    return "You can complete this step from the linked settings page.";
  }
  return "Ask an Organisation Administrator to complete this step.";
}

function buildCoreItems(
  data: SetupQueryResult,
  permissions: SetupPermissionSnapshot,
): SetupItem[] {
  const identityStatus: SetupItemStatus =
    data.organisationStatus === "active" && data.organisationName
      ? "complete"
      : "not_started";

  let administratorStatus: SetupItemStatus = "unavailable";
  let administratorCanAssess = false;
  if (data.ownerCheckUnavailable) {
    administratorStatus = "unavailable";
  } else if (data.hasOrganisationOwner === true) {
    administratorStatus = "complete";
    administratorCanAssess = true;
  } else if (data.hasOrganisationOwner === false) {
    administratorStatus = "not_started";
    administratorCanAssess = true;
  }

  let unitStatus: SetupItemStatus = "unavailable";
  let unitCanAssess = false;
  if (data.activeUnitCountUnavailable) {
    unitStatus = "unavailable";
  } else if ((data.activeUnitCount ?? 0) >= 1) {
    unitStatus = "complete";
    unitCanAssess = true;
  } else {
    unitStatus = "not_started";
    unitCanAssess = true;
  }

  return [
    {
      id: "organisation_identity",
      tier: "core",
      title: "Organisation identity",
      description:
        "Your organisation is registered and active in Lean Excellence Hub.",
      status: identityStatus,
      canAssess: true,
      canPerform: false,
      href: "/platform/settings/organisation",
    },
    {
      id: "organisation_administrator",
      tier: "core",
      title: "Organisation administrator",
      description:
        "An active owner with organisation-wide administrative authority is assigned.",
      status: administratorStatus,
      canAssess: administratorCanAssess,
      canPerform: false,
      href: "/platform/settings",
      helperMessage: administratorCanAssess
        ? undefined
        : "Setup status is managed by your Organisation Administrator.",
    },
    {
      id: "operational_unit",
      tier: "core",
      title: "Operational unit",
      description:
        "At least one active organisational unit anchors improvement work to your structure.",
      status: unitStatus,
      canAssess: unitCanAssess,
      canPerform: permissions.canManageHierarchyAtOrgScope,
      href: "/platform/settings/structure",
      helperMessage: adminHelper(
        permissions.canManageHierarchyAtOrgScope,
        permissions.canManageHierarchyAtOrgScope,
      ),
    },
    {
      id: "admin_organisational_assignment",
      tier: "core",
      title: "Your organisation assignment",
      description:
        "Your primary work area is assigned so you can use downstream modules such as suggestions.",
      status: data.adminAssignmentUnavailable
        ? "unavailable"
        : data.currentAdminHasPrimaryAssignment
          ? "complete"
          : "not_started",
      canAssess: !data.adminAssignmentUnavailable,
      canPerform: permissions.canManageJobFunctions,
      href:
        permissions.currentMembershipAdminHref ?? "/platform/settings/profile",
      helperMessage: adminHelper(
        permissions.canManageJobFunctions,
        permissions.canManageJobFunctions,
      ),
    },
  ];
}

function buildRecommendedItems(
  data: SetupQueryResult,
  permissions: SetupPermissionSnapshot,
): SetupItem[] {
  let structureStatus: SetupItemStatus = "unavailable";
  if (!data.activeUnitCountUnavailable && data.activeUnitCount !== null) {
    if (data.activeUnitCount <= 1) {
      if (data.childUnitsUnavailable) {
        structureStatus =
          data.activeUnitCount >= 1 ? "in_progress" : "not_started";
      } else if (data.hasChildUnits) {
        structureStatus = "in_progress";
      } else {
        structureStatus = "not_started";
      }
    } else {
      structureStatus = "in_progress";
    }
  }

  let inviteStatus: SetupItemStatus = "unavailable";
  if (!data.membershipCountUnavailable && data.activeMembershipCount !== null) {
    if (data.activeMembershipCount > 1) {
      inviteStatus = "complete";
    } else if (
      !data.pendingInvitationsUnavailable &&
      (data.pendingInvitationCount ?? 0) > 0
    ) {
      inviteStatus = "in_progress";
    } else {
      inviteStatus = "not_started";
    }
  }

  let rolesStatus: SetupItemStatus = "unavailable";
  if (!data.grantsCheckUnavailable) {
    if ((data.nonOwnerGrantCount ?? 0) > 0) {
      rolesStatus = "complete";
    } else if (data.customRolesCheckUnavailable) {
      rolesStatus = "not_started";
    } else if (data.customRoleWithoutGrant) {
      rolesStatus = "in_progress";
    } else {
      rolesStatus = "not_started";
    }
  }

  let jobFnStatus: SetupItemStatus = "unavailable";
  if (!data.jobFunctionsUnavailable) {
    if ((data.activeJobFunctionCount ?? 0) === 0) {
      jobFnStatus = "not_started";
    } else if (
      !data.jobFunctionAssignmentsUnavailable &&
      (data.jobFunctionAssignmentCount ?? 0) > 0
    ) {
      jobFnStatus = "complete";
    } else {
      jobFnStatus = "setup_started";
    }
  }

  let leanStatus: SetupItemStatus = "unavailable";
  if (!data.leanConfigUnavailable) {
    leanStatus =
      (data.leanConfigSignalCount ?? 0) > 0 ? "setup_started" : "not_started";
  }

  let trainingStatus: SetupItemStatus = "unavailable";
  if (!data.trainingCatalogUnavailable) {
    trainingStatus =
      (data.trainingCatalogCount ?? 0) > 0 ? "setup_started" : "not_started";
  }

  return [
    {
      id: "expand_structure",
      tier: "recommended",
      title: "Expand organisation structure",
      description:
        "Add units that reflect how your organisation operates. A single-site organisation may need only one unit.",
      status: structureStatus,
      canAssess: !data.activeUnitCountUnavailable,
      canPerform: permissions.canManageHierarchy,
      href: "/platform/settings/structure",
      helperMessage: adminHelper(permissions.canManageHierarchy),
    },
    {
      id: "invite_team",
      tier: "recommended",
      title: "Invite your team",
      description:
        "Bring colleagues into your organisation with appropriate access.",
      status: inviteStatus,
      canAssess: !data.membershipCountUnavailable,
      canPerform: permissions.canManageInvitations,
      href: "/platform/settings/people",
      helperMessage: adminHelper(permissions.canManageInvitations),
    },
    {
      id: "roles_access",
      tier: "recommended",
      title: "Assign roles and access",
      description:
        "Delegate responsibilities beyond the organisation owner when your team is ready.",
      status: rolesStatus,
      canAssess: !data.grantsCheckUnavailable,
      canPerform: permissions.canReadRoles,
      href: "/platform/settings/people",
      helperMessage: adminHelper(
        permissions.canManageInvitations || permissions.canReadRoles,
      ),
    },
    {
      id: "job_functions",
      tier: "recommended",
      title: "Configure job functions",
      description:
        "Define the roles people perform so training and capability can be organised.",
      status: jobFnStatus,
      canAssess: !data.jobFunctionsUnavailable,
      canPerform: permissions.canManageJobFunctions,
      href: "/platform/settings/job-functions",
      helperMessage: adminHelper(permissions.canManageJobFunctions),
    },
    {
      id: "lean_configuration",
      tier: "recommended",
      title: "Configure Lean programme",
      description:
        "Start maturity, 5S, Gemba, suggestions, or templates for your improvement system.",
      status: leanStatus,
      canAssess: !data.leanConfigUnavailable,
      canPerform: true,
      href: "/platform/maturity",
    },
    {
      id: "training_configuration",
      tier: "recommended",
      title: "Configure training",
      description: "Build your training catalogue and curriculum over time.",
      status: trainingStatus,
      canAssess: !data.trainingCatalogUnavailable,
      canPerform: permissions.canManageTraining,
      href: "/platform/training",
      helperMessage: adminHelper(
        permissions.canManageTraining,
        permissions.canManageTraining,
      ),
    },
  ];
}

export function evaluateCoreSetup(items: SetupItem[]): CoreSetupState {
  const assessable = items.filter((item) => item.canAssess);
  const canAssessAll = assessable.length === items.length;
  const allComplete =
    canAssessAll && items.every((item) => item.status === "complete");

  let readyLabel: CoreSetupState["readyLabel"] = "in_progress";
  if (!canAssessAll) {
    readyLabel = "managed_by_admin";
  } else if (allComplete) {
    readyLabel = "ready";
  }

  return { items, allComplete, canAssessAll, readyLabel };
}

export function evaluateRecommendedSetup(
  items: SetupItem[],
): RecommendedSetupState {
  return { items };
}

export function pickNextAction(
  core: CoreSetupState,
  recommended: RecommendedSetupState,
): { href: string | null; label: string | null } {
  const incompleteCore = core.items.find(
    (item) =>
      item.canAssess &&
      item.status !== "complete" &&
      item.status !== "unavailable",
  );
  if (incompleteCore?.href && incompleteCore.canPerform) {
    return {
      href: incompleteCore.href,
      label: "Continue core setup",
    };
  }

  const nextRecommended = recommended.items.find(
    (item) =>
      item.canAssess &&
      item.status !== "complete" &&
      item.status !== "unavailable" &&
      item.canPerform &&
      item.href,
  );
  if (nextRecommended?.href) {
    return {
      href: nextRecommended.href,
      label: nextRecommended.title,
    };
  }

  if (!core.allComplete && core.canAssessAll) {
    return { href: "/platform/setup", label: "Continue setup" };
  }

  return { href: "/platform/setup", label: "View setup progress" };
}

export function buildOrganisationSetupSnapshot(
  data: SetupQueryResult,
  permissions: SetupPermissionSnapshot,
): OrganisationSetupSnapshot {
  const coreItems = buildCoreItems(data, permissions);
  const recommendedItems = buildRecommendedItems(data, permissions);
  const core = evaluateCoreSetup(coreItems);
  const recommended = evaluateRecommendedSetup(recommendedItems);
  const next = pickNextAction(core, recommended);

  return {
    organisationName: data.organisationName ?? "Your organisation",
    organisationCode: data.organisationCode,
    core,
    recommended,
    nextActionHref: next.href,
    nextActionLabel: next.label,
  };
}

export function buildQuickActions(
  permissions: SetupPermissionSnapshot,
): import("./types").QuickAction[] {
  const actions: import("./types").QuickAction[] = [];

  if (permissions.canManageHierarchyAtOrgScope) {
    actions.push({
      label: "Add unit",
      href: "/platform/settings/structure",
      description: "Create an organisational unit",
    });
  }
  if (permissions.canManageInvitations) {
    actions.push({
      label: "Invite user",
      href: "/platform/settings/people",
      description: "Manage team invitations",
    });
  }
  if (permissions.canManageJobFunctions) {
    actions.push({
      label: "Create job function",
      href: "/platform/settings/job-functions",
      description: "Define a job function",
    });
  }
  actions.push({
    label: "Start Lean maturity",
    href: "/platform/maturity",
    description: "Open maturity programme",
  });
  if (permissions.canManageProjects) {
    actions.push({
      label: "Create CI project",
      href: "/platform/projects/new",
      description: "Start a continuous improvement project",
    });
  }

  return actions.slice(0, 5);
}
