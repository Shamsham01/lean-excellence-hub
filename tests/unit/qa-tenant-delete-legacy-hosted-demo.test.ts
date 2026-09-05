import { afterEach, describe, expect, it, vi } from "vitest";

import * as authIdentityCleanup from "../../scripts/qa-tenant/auth-identity-cleanup";
import * as dbCli from "../../scripts/qa-tenant/db-cli";
import {
  assertLegacyAuthUsersIsolated,
  captureLegacyDeletionContext,
  deleteLegacyHostedDemoAuthUsers,
} from "../../scripts/qa-tenant/delete-legacy-hosted-demo";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockLegacyAuthQueries(options: {
  legacyUserIds: string[];
  deletableUserIds: string[];
  conflicts?: Array<{
    user_id: string;
    organisation_id: string;
    organisation_code: string;
    organisation_name: string;
  }>;
  membershipCount?: number;
}) {
  vi.spyOn(dbCli, "runSupabaseDbQueryJson").mockImplementation(
    (queryOptions) => {
      const sql = String(queryOptions.sql);

      if (sql.includes("where id = '402811bb")) {
        return [
          {
            id: "402811bb-aa05-4128-b7e5-a1e3b359b92e",
            code: "lean-excellence-demo",
            name: "Lean Excellence Demo",
          },
        ];
      }

      if (sql.includes("where code = 'lean-excellence-demo'")) {
        return [
          {
            id: "402811bb-aa05-4128-b7e5-a1e3b359b92e",
            code: "lean-excellence-demo",
            name: "Lean Excellence Demo",
          },
        ];
      }

      if (sql.includes("count(*)::int as count")) {
        return [
          { count: options.membershipCount ?? options.legacyUserIds.length },
        ];
      }

      if (sql.includes("with legacy_members as")) {
        return options.deletableUserIds.map((userId) => ({ user_id: userId }));
      }

      if (sql.includes("select distinct membership.user_id")) {
        return options.legacyUserIds.map((userId) => ({ user_id: userId }));
      }

      if (sql.includes("other_org.id as organisation_id")) {
        return options.conflicts ?? [];
      }

      return [];
    },
  );
}

describe("legacy auth deletion ordering", () => {
  it("deletes the exact captured auth user IDs without re-querying memberships", async () => {
    const capturedIds = [
      "d0000000-0000-0000-0000-000000000001",
      "d0000000-0000-0000-0000-000000000002",
    ];
    const purge = vi
      .spyOn(authIdentityCleanup, "purgeAuthUserIdentityPrerequisites")
      .mockImplementation(() => undefined);
    const deleteUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: null });
    const admin = {
      auth: {
        admin: {
          deleteUser,
        },
      },
    } as never;

    await deleteLegacyHostedDemoAuthUsers(admin, capturedIds, {
      databaseUrl: "postgresql://example",
    });

    expect(purge).toHaveBeenCalledWith("postgresql://example", capturedIds);
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenNthCalledWith(1, capturedIds[0]);
    expect(deleteUser).toHaveBeenNthCalledWith(2, capturedIds[1]);
  });
});

describe("legacy auth isolation", () => {
  it("aborts when legacy and deletable auth user sets differ", () => {
    mockLegacyAuthQueries({
      legacyUserIds: ["user-1", "user-2"],
      deletableUserIds: ["user-1"],
      conflicts: [
        {
          user_id: "user-2",
          organisation_id: "other-org-id",
          organisation_code: "other-org",
          organisation_name: "Other Org",
        },
      ],
      membershipCount: 2,
    });

    expect(() => assertLegacyAuthUsersIsolated("postgresql://example")).toThrow(
      /auth isolation failed/i,
    );
    expect(() =>
      captureLegacyDeletionContext("postgresql://example", {
        expectedMemberships: 2,
      }),
    ).toThrow(/auth isolation failed/i);
  });

  it("allows destructive preparation when all legacy users are isolated", () => {
    mockLegacyAuthQueries({
      legacyUserIds: ["user-1", "user-2"],
      deletableUserIds: ["user-1", "user-2"],
      membershipCount: 2,
    });

    const context = captureLegacyDeletionContext("postgresql://example", {
      expectedMemberships: 2,
    });

    expect(context.legacyAuthUserIds).toEqual(["user-1", "user-2"]);
    expect(context.deletableAuthUserIds).toEqual(["user-1", "user-2"]);
  });
});
