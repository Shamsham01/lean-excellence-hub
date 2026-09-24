import { describe, expect, it, vi } from "vitest";

import {
  chunkInvitationIds,
  loadPendingInvitationGrants,
  PENDING_INVITATION_GRANT_BATCH_SIZE,
  type PendingInvitationGrant,
} from "@/modules/organisation/pending-invitation-grants";

function grantFor(invitationId: string): PendingInvitationGrant {
  return {
    invitation_id: invitationId,
    scope_type: "organisation",
    scope_unit_id: null,
    role_version_id: `role-${invitationId}`,
  };
}

describe("chunkInvitationIds", () => {
  it("splits ids into bounded batches", () => {
    expect(chunkInvitationIds(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("rejects a non-positive batch size", () => {
    expect(() => chunkInvitationIds(["a"], 0)).toThrow(
      "Invitation grant batch size must be at least 1.",
    );
  });
});

describe("loadPendingInvitationGrants", () => {
  it("does not query when there are no pending invitations", async () => {
    const queryGrants = vi.fn();

    await expect(loadPendingInvitationGrants(queryGrants, [])).resolves.toEqual(
      {
        data: [],
        error: null,
      },
    );
    expect(queryGrants).not.toHaveBeenCalled();
  });

  it("issues one bounded query when the id set fits a single batch", async () => {
    const invitationIds = ["inv-1", "inv-2"];
    const queryGrants = vi.fn(async (batch: readonly string[]) => ({
      data: batch.map((invitationId) => grantFor(invitationId)),
      error: null,
    }));

    const result = await loadPendingInvitationGrants(
      queryGrants,
      invitationIds,
      {
        batchSize: 50,
      },
    );

    expect(queryGrants).toHaveBeenCalledTimes(1);
    expect(queryGrants).toHaveBeenCalledWith(invitationIds);
    expect(result).toEqual({
      data: [grantFor("inv-1"), grantFor("inv-2")],
      error: null,
    });
  });

  it("loads grants across multiple batches and concatenates them in order", async () => {
    const invitationIds = Array.from(
      { length: PENDING_INVITATION_GRANT_BATCH_SIZE * 2 + 3 },
      (_, index) => `inv-${index + 1}`,
    );
    const queryGrants = vi.fn(async (batch: readonly string[]) => ({
      data: batch.map((invitationId) => grantFor(invitationId)),
      error: null,
    }));

    const result = await loadPendingInvitationGrants(
      queryGrants,
      invitationIds,
    );

    expect(queryGrants).toHaveBeenCalledTimes(3);
    expect(queryGrants.mock.calls[0]?.[0]).toHaveLength(
      PENDING_INVITATION_GRANT_BATCH_SIZE,
    );
    expect(queryGrants.mock.calls[1]?.[0]).toHaveLength(
      PENDING_INVITATION_GRANT_BATCH_SIZE,
    );
    expect(queryGrants.mock.calls[2]?.[0]).toEqual([
      "inv-101",
      "inv-102",
      "inv-103",
    ]);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(invitationIds.length);
    expect(result.data?.[0]?.invitation_id).toBe("inv-1");
    expect(result.data?.[invitationIds.length - 1]?.invitation_id).toBe(
      "inv-103",
    );
  });

  it("fails closed when a later batch errors and does not return partial grants", async () => {
    const invitationIds = ["inv-1", "inv-2", "inv-3"];
    const queryGrants = vi.fn(async (batch: readonly string[]) => {
      if (batch.includes("inv-3")) {
        return {
          data: null,
          error: { message: "statement timeout" },
        };
      }

      return {
        data: batch.map((invitationId) => grantFor(invitationId)),
        error: null,
      };
    });

    const result = await loadPendingInvitationGrants(
      queryGrants,
      invitationIds,
      {
        batchSize: 2,
      },
    );

    expect(queryGrants).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      data: null,
      error: { message: "statement timeout" },
    });
  });
});
