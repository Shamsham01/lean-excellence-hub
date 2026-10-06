import { expect, test } from "@playwright/test";

test("homepage story is reachable from the header and has no playground", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Operational excellence. Connected.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Try LEH" })).toHaveCount(0);
  await expect(page.getByTestId("leh-demo-start-suggestion")).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", {
      name: "Why LEH",
    })
    .click();
  await expect(page).toHaveURL(/#why/);
  await expect(
    page.getByRole("heading", {
      name: "Improvement shouldn't live in fragments.",
    }),
  ).toBeVisible();
});

test("scroll progress reverses when the page scrolls back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator(".kinetic-story")).toHaveAttribute(
    "data-motion",
    "on",
  );

  await page.evaluate(() => {
    const scene = document.getElementById("why");
    if (!scene) {
      return;
    }
    const top = window.scrollY + scene.getBoundingClientRect().top;
    window.scrollTo(0, top + 48);
  });

  const read = () =>
    page
      .locator("#why")
      .evaluate((el) =>
        Number.parseFloat(el.style.getPropertyValue("--scatter") || "0"),
      );

  await expect.poll(read).toBeLessThan(0.2);
  const start = await read();
  await page.evaluate(() => window.scrollBy(0, 720));
  await expect.poll(read).toBeGreaterThan(start + 0.2);
  const forward = await read();
  await page.evaluate(() => window.scrollBy(0, -720));
  await expect.poll(read).toBeLessThan(forward - 0.2);
});

test("mobile homepage keeps native vertical flow without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Operational excellence. Connected." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", {
      name: "Platform",
    })
    .click();
  await expect(page).toHaveURL(/#platform/);
  await expect(
    page.getByRole("heading", { name: "One connected improvement system." }),
  ).toBeVisible();

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  const trackDirection = await page
    .locator(".kinetic-track")
    .evaluate((el) => getComputedStyle(el).flexDirection);
  expect(trackDirection).toBe("column");
});

test("reduced motion lays the story out without pinned scenes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Operational excellence. Connected.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("A person reviews. A person decides.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your framework. Your standards. Your way of working.",
    }),
  ).toBeVisible();

  await expect(page.locator(".kinetic-story")).toHaveAttribute(
    "data-motion",
    "off",
  );

  const positions = await page
    .locator(".kinetic-stage")
    .evaluateAll((stages) =>
      stages.map((stage) => getComputedStyle(stage).position),
    );
  expect(positions.length).toBeGreaterThan(0);
  expect(positions.every((position) => position === "relative")).toBeTruthy();
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
