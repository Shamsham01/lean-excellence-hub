import { expect, test, type Page } from "@playwright/test";

const SCROLL_Y = 3200;

async function headerState(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".marketing-header");
    if (!header) {
      throw new Error("Marketing header not found");
    }
    const rect = header.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      height: Math.round(rect.height),
      scrollY: Math.round(window.scrollY),
    };
  });
}

async function scrollIntoPage(page: Page) {
  await page.evaluate((y) => window.scrollTo(0, y), SCROLL_Y);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(SCROLL_Y);
}

test.describe("marketing header theme stability", () => {
  test.use({ colorScheme: "light" });

  test("switching appearance after scrolling keeps the sticky header in place", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await scrollIntoPage(page);

    const banner = page.getByRole("banner");
    const before = await headerState(page);
    expect(before.top).toBe(0);
    expect(before.scrollY).toBe(SCROLL_Y);

    for (const choice of ["Dark", "Light", "Dark", "System"] as const) {
      await banner.getByRole("button", { name: /^Appearance: / }).click();
      await expect(
        page.getByRole("menu", { name: "Appearance" }),
      ).toBeVisible();
      expect(await headerState(page)).toEqual(before);

      await page.getByRole("menuitemradio", { name: choice }).click();
      await expect(
        banner.getByRole("button", { name: `Appearance: ${choice}` }),
      ).toBeVisible();
      expect(await headerState(page)).toEqual(before);
    }

    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("body")).not.toHaveAttribute(
      "data-scroll-locked",
      /.*/,
    );
  });

  test("the appearance menu stays keyboard operable after scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await scrollIntoPage(page);

    const banner = page.getByRole("banner");
    const before = await headerState(page);
    const trigger = banner.getByRole("button", { name: "Appearance: System" });

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Appearance" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.activeElement?.closest('[role="menu"]')),
        ),
      )
      .toBe(true);
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitemradio", { name: "Dark" }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await expect(
      page.getByRole("menuitemradio", { name: "System" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitemradio", { name: "Light" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitemradio", { name: "Dark" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    const darkTrigger = banner.getByRole("button", {
      name: "Appearance: Dark",
    });
    await expect(darkTrigger).toBeFocused();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await headerState(page)).toEqual(before);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Appearance" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Appearance" })).toBeHidden();
    await expect(darkTrigger).toBeFocused();
    expect(await headerState(page)).toEqual(before);
  });

  test("mobile appearance switching keeps the header and scroll position", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await scrollIntoPage(page);

    const before = await headerState(page);
    expect(before.top).toBe(0);

    await page.getByRole("button", { name: "Open menu" }).click();
    const group = page.getByRole("group", { name: "Appearance" });
    await expect(group).toBeVisible();
    expect(await headerState(page)).toEqual(before);

    for (const choice of ["Dark", "Light", "System"] as const) {
      await group.getByRole("button", { name: choice }).click();
      await expect(group.getByRole("button", { name: choice })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(
        page
          .getByRole("banner")
          .getByRole("button", { name: `Appearance: ${choice}` }),
      ).toBeVisible();
      expect(await headerState(page)).toEqual(before);
    }

    await page.keyboard.press("Escape");
    await expect(group).toBeHidden();
    expect(await headerState(page)).toEqual(before);
  });
});
