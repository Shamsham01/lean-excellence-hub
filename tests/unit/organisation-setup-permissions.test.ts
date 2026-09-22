/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const currentMemberHasPermission = vi.fn();
const currentMemberHasOrganisationScopedPermission = vi.fn();
const listEligibleOrganisations = vi.fn(async () => [
  { selected: true, membership_id: "mem-1" },
]);

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasPermission: (...args: unknown[]) =>
    currentMemberHasPermission(...args),
  currentMemberHasOrganisationScopedPermission: (...args: unknown[]) =>
    currentMemberHasOrganisationScopedPermission(...args),
}));

vi.mock("@/modules/organisations/context", () => ({
  listEligibleOrganisations: () => listEligibleOrganisations(),
}));

import { loadSetupPermissions } from "@/modules/organisation-setup/permissions";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";

function grantAllExcept(trainingManageKeys: string[]) {
  currentMemberHasPermission.mockImplementation(async (key: string) => {
    if (key === "training.manage") {
      return false;
    }
    if (
      key === TRAINING_PERMISSIONS.catalogManage ||
      key === TRAINING_PERMISSIONS.curriculumManage ||
      key === TRAINING_PERMISSIONS.sessionsManage
    ) {
      return trainingManageKeys.includes(key);
    }
    if (key === TRAINING_PERMISSIONS.read) {
      return true;
    }
    return true;
  });
  currentMemberHasOrganisationScopedPermission.mockResolvedValue(false);
}

describe("loadSetupPermissions training gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks canManageTraining true when any real M7 manage permission is granted", async () => {
    grantAllExcept([TRAINING_PERMISSIONS.catalogManage]);

    const permissions = await loadSetupPermissions();

    expect(permissions.canManageTraining).toBe(true);
    expect(currentMemberHasPermission).toHaveBeenCalledWith(
      TRAINING_PERMISSIONS.catalogManage,
    );
    expect(currentMemberHasPermission).not.toHaveBeenCalledWith(
      "training.manage",
    );
  });

  it("marks canManageTraining false when only training.read is granted", async () => {
    grantAllExcept([]);

    const permissions = await loadSetupPermissions();

    expect(permissions.canManageTraining).toBe(false);
    expect(permissions.canReadTraining).toBe(true);
  });

  it("marks canManageTraining true for curriculum manage without catalog manage", async () => {
    grantAllExcept([TRAINING_PERMISSIONS.curriculumManage]);

    const permissions = await loadSetupPermissions();

    expect(permissions.canManageTraining).toBe(true);
  });
});
