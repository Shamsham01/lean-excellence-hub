import { expect, test } from "@playwright/test";

const HERO = "Make continuous improvement visible, accountable and measurable.";

test("homepage story is reachable from the header and has no playground", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: HERO }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Try LEH" })).toHaveCount(0);
  await expect(page.getByTestId("leh-demo-start-suggestion")).toHaveCount(0);
  await expect(page.locator(".kinetic-story")).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Why LEH" })
    .click();
  await expect(page).toHaveURL(/#why/);
  await expect(
    page.getByRole("heading", {
      name: "One finding. Every next step connected.",
    }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "LeanAI" })
    .click();
  await expect(page).toHaveURL(/#leanai/);
  await expect(
    page.getByRole("heading", {
      name: "Context first. Assistance second. You decide.",
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("hero actions reach the platform and account creation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("link", { name: "Explore the platform" }).click();
  await expect(page).toHaveURL(/#platform/);
  await expect(
    page.getByRole("heading", { name: "One connected improvement system." }),
  ).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Create an account" }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});

test("mobile homepage keeps native vertical flow without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: HERO })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore the platform" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", { name: "Platform" })
    .click();
  await expect(page).toHaveURL(/#platform/);
  await expect(
    page.getByRole("heading", { name: "One connected improvement system." }),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const sections = [...document.querySelectorAll("main section")].map(
      (section) => ({
        id: section.id,
        position: getComputedStyle(section).position,
        height: section.getBoundingClientRect().height,
      }),
    );
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      sections,
    };
  });
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  const hero = metrics.sections.find((section) => section.id === "connect");
  expect(hero?.position).not.toBe("fixed");
  expect(hero?.height ?? 0).toBeGreaterThan(520);
  expect(hero?.height ?? 0).toBeLessThan(1500);
});

test("reduced motion lays the story out in normal document flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: HERO })).toBeVisible();
  await expect(
    page.getByText("A person reviews. A person decides.").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your framework. Your standards. Your way of working.",
    }),
  ).toBeVisible();
  await expect(page.locator(".kinetic-story")).toHaveCount(0);

  const positions = await page
    .locator("main section")
    .evaluateAll((sections) =>
      sections.map((section) => getComputedStyle(section).position),
    );
  expect(positions.length).toBeGreaterThan(0);
  expect(
    positions.every(
      (position) => position === "static" || position === "relative",
    ),
  ).toBeTruthy();
});

test("vertical wheel over the skills matrix continues the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#training-skills");
  const matrix = page.locator("#training-skills .marketing-matrix-scroll");
  await expect(matrix).toBeVisible();
  const box = await matrix.boundingBox();

  if (!box) {
    throw new Error("Training skills matrix has no box");
  }

  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(box.height / 2, 48),
  );
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 480);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(before + 40);
});

test("LeanAI governance is visible without a scroll-scrubbed stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/#leanai");

  await expect(
    page.getByRole("heading", {
      name: "Context first. Assistance second. You decide.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "LeanAI does not publish frameworks, close actions, grant access or purchase site capacity.",
    ),
  ).toBeVisible();
  await expect(page.locator("#leanai")).not.toHaveAttribute("data-beat", /.+/);

  const height = await page
    .locator("#leanai")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(320);
  expect(height).toBeLessThan(2200);
});

test("selecting a connected step shows that record", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#why");
  await page.getByRole("button", { name: /Solve/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Recurring film wander on Packing Line 1",
    }),
  ).toBeVisible();
  await expect(page.getByText("PS-077").first()).toBeVisible();
});

test("tablet width keeps the headline, preview and platform reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: HERO })).toBeVisible();
  await expect(
    page.getByText("Harbourfield Foods Group").first(),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("keyboard reaches the hero actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
