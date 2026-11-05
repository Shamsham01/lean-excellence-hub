// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HARBOURFIELD_USERS } from "../../scripts/harbourfield-demo/constants";

const signInWithPassword = vi.fn();
const createClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const originalEnv = { ...process.env };

function buildQueryClient(responses: {
  units?: Array<{ id: string; code: string }>;
  membershipByUserId?: Record<string, string | null>;
}) {
  const membershipByUserId = responses.membershipByUserId ?? {};

  const from = vi.fn((table: string) => {
    if (table === "organisation_units") {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(function (column: string) {
          if (column === "organisation_id") {
            return {
              then: undefined,
              data: responses.units ?? [],
              error: null,
            };
          }
          return chain;
        }),
      };
      chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce({
        data: responses.units ?? [],
        error: null,
      });
      return chain;
    }

    if (table === "organisation_memberships") {
      let userIdFilter: string | undefined;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((column: string, value: string) => {
          if (column === "user_id") {
            userIdFilter = value;
          }
          return chain;
        }),
        maybeSingle: vi.fn().mockImplementation(async () => {
          const membershipId = userIdFilter
            ? (membershipByUserId[userIdFilter] ?? null)
            : null;
          return {
            data: membershipId ? { id: membershipId } : null,
            error: null,
          };
        }),
      };
      return chain;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    auth: { signInWithPassword },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from,
  };
}

describe("buildHarbourfieldClients", () => {
  beforeEach(() => {
    vi.resetModules();
    signInWithPassword.mockReset();
    createClient.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses hosted admin env credentials and real membership user ids", async () => {
    process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_EMAIL =
      "hosted-admin@example.com";
    process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_PASSWORD = "hosted-secret";

    const hostedAdminId = "11111111-1111-1111-1111-111111111111";
    const hostedClient = buildQueryClient({
      units: [{ id: "unit-1", code: "bodmin-bakery" }],
      membershipByUserId: {
        [hostedAdminId]: "membership-hosted-admin",
      },
    });

    signInWithPassword.mockImplementation(async ({ email }) => {
      if (email === "hosted-admin@example.com") {
        return {
          data: { session: {}, user: { id: hostedAdminId } },
          error: null,
        };
      }
      return {
        data: { session: null, user: null },
        error: new Error("missing"),
      };
    });

    createClient.mockImplementation(() => hostedClient);

    const { buildHarbourfieldClients } =
      await import("../../scripts/harbourfield-demo/apply-top-up");

    const result = await buildHarbourfieldClients({
      apiUrl: "https://demo.supabase.co",
      publishableKey: "publishable-key",
      organisation: {
        id: "org-id",
        code: "harbourfield-foods-group",
        name: "Harbourfield Foods Group",
      },
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "hosted-admin@example.com",
      password: "hosted-secret",
    });
    expect(result.managerMembershipId).toBe("membership-hosted-admin");
    expect(result.operatorMembershipId).toBeNull();
    expect(result.manager).toBe(result.admin);
  });

  it("resolves local persona membership ids when personas sign in", async () => {
    delete process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_EMAIL;
    delete process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_PASSWORD;

    const clientsByEmail = new Map<
      string,
      ReturnType<typeof buildQueryClient>
    >();

    signInWithPassword.mockImplementation(async ({ email }) => {
      const user = Object.values(HARBOURFIELD_USERS).find(
        (persona) => persona.email === email,
      );
      if (!user) {
        return {
          data: { session: null, user: null },
          error: new Error("missing"),
        };
      }

      const client = buildQueryClient({
        units: [{ id: "unit-1", code: "bodmin-bakery" }],
        membershipByUserId: {
          [HARBOURFIELD_USERS.manager.id]: "membership-manager",
          [HARBOURFIELD_USERS.operator.id]: "membership-operator",
        },
      });
      clientsByEmail.set(email, client);

      return {
        data: { session: {}, user: { id: user.id } },
        error: null,
      };
    });

    createClient.mockImplementation(() => {
      const lastEmail = signInWithPassword.mock.calls.at(-1)?.[0]?.email;
      return (
        clientsByEmail.get(lastEmail) ??
        buildQueryClient({
          units: [{ id: "unit-1", code: "bodmin-bakery" }],
          membershipByUserId: {
            [HARBOURFIELD_USERS.manager.id]: "membership-manager",
            [HARBOURFIELD_USERS.operator.id]: "membership-operator",
          },
        })
      );
    });

    const { buildHarbourfieldClients } =
      await import("../../scripts/harbourfield-demo/apply-top-up");

    const result = await buildHarbourfieldClients({
      apiUrl: "http://127.0.0.1:54321",
      publishableKey: "publishable-key",
      organisation: {
        id: "org-id",
        code: "harbourfield-foods-group",
        name: "Harbourfield Foods Group",
      },
    });

    expect(result.managerMembershipId).toBe("membership-manager");
    expect(result.operatorMembershipId).toBe("membership-operator");
  });
});
