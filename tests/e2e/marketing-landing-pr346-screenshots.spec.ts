import { expect, test } from "@playwright/test";

test.use({ colorScheme: "dark", reducedMotion: "reduce" });

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`captures the dark landing at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("#hero").getByRole("status")).toHaveText(
      "Verified",
    );
    await page.screenshot({
      path: testInfo.outputPath("first-fold.png"),
      animations: "disabled",
    });
    for (const section of ["hero", "connect", "close"]) {
      const target = page.locator(`#${section}`);
      await expect(target).toBeVisible();
      await target.screenshot({
        path: testInfo.outputPath(`${section}.png`),
        animations: "disabled",
      });
    }
    await page.getByRole("contentinfo").screenshot({
      path: testInfo.outputPath("footer.png"),
      animations: "disabled",
    });
  });
}
