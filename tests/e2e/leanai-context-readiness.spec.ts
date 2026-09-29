import { expect, test } from "@playwright/test";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("LeanAI semantic context and setup readiness", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("empty organisation readiness works without an AI provider", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);

    const response = await page.request.get("/api/leanai/context");
    expect(response.ok()).toBeTruthy();
    const snapshot = (await response.json()) as {
      applicationAiAvailable: boolean;
      readiness: {
        organisationId: string;
        items: Array<{ key: string; status: string }>;
      };
      journey: { recentModuleKey: string | null; organisationId: string };
    };

    const status = Object.fromEntries(
      snapshot.readiness.items.map((item) => [item.key, item.status]),
    );
    expect(status.organisation).toBe("ready");
    expect(status.sites).toBe("not_started");
    expect(status.people).toBe("incomplete");
    expect(status.five_s).toBe("blocked");
    expect(
      status.lean_ai === "not_started" || status.lean_ai === "incomplete",
    ).toBe(true);

    const recorded = await page.request.post("/api/leanai/context", {
      data: { eventKey: "module.opened", moduleKey: "maturity" },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(recorded.status()).toBe(201);

    const after = await page.request.get("/api/leanai/context");
    const afterJson = (await after.json()) as {
      journey: { recentModuleKey: string | null; organisationId: string };
    };
    expect(afterJson.journey.recentModuleKey).toBe("maturity");
    expect(afterJson.journey.organisationId).toBe(
      snapshot.readiness.organisationId,
    );
  });

  test("switching organisation does not leak journey context", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await loginAndSelectOrganisation(page, user, user.organisationBName);

    const response = await page.request.get("/api/leanai/context");
    expect(response.ok()).toBeTruthy();
    const snapshot = (await response.json()) as {
      readiness: {
        organisationId: string;
        items: Array<{ key: string; status: string }>;
      };
      journey: { recentModuleKey: string | null; organisationId: string };
    };

    expect(snapshot.journey.recentModuleKey).toBeNull();
    const suggestions = snapshot.readiness.items.find(
      (item) => item.key === "suggestions",
    );
    expect(suggestions?.status).toBe("not_started");

    await page.request.post("/api/leanai/context", {
      data: {
        eventKey: "onboarding.step_skipped",
        metadata: { step_key: "structure" },
      },
      headers: { origin: new URL(page.url()).origin },
    });

    await page.goto("/select-organisation");
    await page.getByRole("button", { name: user.organisationAName }).click();
    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });

    const orgA = await page.request.get("/api/leanai/context");
    const orgAJson = (await orgA.json()) as {
      journey: {
        recentModuleKey: string | null;
        lastOnboardingEventKey: string | null;
        organisationId: string;
      };
    };
    expect(orgAJson.journey.recentModuleKey).toBe("maturity");
    expect(orgAJson.journey.lastOnboardingEventKey).not.toBe(
      "onboarding.step_skipped",
    );
    expect(orgAJson.journey.organisationId).not.toBe(
      snapshot.journey.organisationId,
    );
  });
});
