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

test("vertical wheel over the skills matrix continues the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#training-skills");
  await expect(page.locator(".kinetic-story")).toHaveAttribute(
    "data-motion",
    "on",
  );

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

  const mid = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 48);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(mid + 8);
});

test("LeanAI stays inside the sticky stage at 1366×768", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator(".kinetic-story")).toHaveAttribute(
    "data-motion",
    "on",
  );

  const positions = [0.08, 0.22, 0.36, 0.5, 0.66, 0.9];

  for (const progress of positions) {
    await page.evaluate((target) => {
      const scene = document.getElementById("leanai");
      if (!scene) {
        return;
      }
      const top = window.scrollY + scene.getBoundingClientRect().top;
      const scrollable = scene.offsetHeight - window.innerHeight;
      window.scrollTo(0, top + scrollable * target);
    }, progress);

    await expect
      .poll(async () =>
        page.locator("#leanai").evaluate((el) => el.dataset.beat ?? ""),
      )
      .not.toBe("");

    const fit = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(
        "#leanai .kinetic-stage",
      );
      if (!stage) {
        return { ok: false, reason: "missing stage" };
      }
      const stageBox = stage.getBoundingClientRect();
      const safe = 8;
      const visible = [
        ...stage.querySelectorAll<HTMLElement>("[data-lean-visible='true']"),
      ];
      const nodes = [
        ...stage.querySelectorAll<HTMLElement>(
          ".kinetic-leanai-copy, .kinetic-lean-nav li",
        ),
        ...visible.flatMap((root) => [
          root,
          ...root.querySelectorAll<HTMLElement>("p, li"),
        ]),
      ];
      const offenders = nodes
        .filter((node) => {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") {
            return false;
          }
          let ancestor: HTMLElement | null = node;
          let visual = 1;
          while (ancestor && ancestor !== stage) {
            visual *= Number.parseFloat(
              getComputedStyle(ancestor).opacity || "1",
            );
            ancestor = ancestor.parentElement;
          }
          if (visual < 0.4) {
            return false;
          }
          const box = node.getBoundingClientRect();
          return (
            box.height > 2 &&
            box.width > 2 &&
            (box.bottom > stageBox.bottom - safe || box.top < stageBox.top + 2)
          );
        })
        .map(
          (node) =>
            node.dataset.leanTitle ||
            node.dataset.leanPanel ||
            node.textContent?.trim().slice(0, 42) ||
            node.className,
        );

      return {
        ok: offenders.length === 0,
        reason: offenders.join(" | "),
        beat: document.getElementById("leanai")?.dataset.beat ?? "",
      };
    });

    expect(fit.ok, `progress ${progress} beat ${fit.beat}: ${fit.reason}`).toBe(
      true,
    );
  }
});

test("LeanAI beats advance and reverse under large wheel deltas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/#leanai");
  await expect(page.locator(".kinetic-story")).toHaveAttribute(
    "data-motion",
    "on",
  );

  await page.mouse.move(680, 380);
  await page.evaluate(() => {
    const scene = document.getElementById("leanai");
    if (!scene) {
      return;
    }
    const top = window.scrollY + scene.getBoundingClientRect().top;
    window.scrollTo(0, top + 24);
  });

  const read = () =>
    page.locator("#leanai").evaluate((el) => ({
      progress: Number.parseFloat(el.style.getPropertyValue("--p") || "0"),
      beat: Number.parseInt(el.dataset.beat || "0", 10),
    }));

  await expect.poll(async () => (await read()).progress).toBeLessThan(0.2);

  const forward: number[] = [];
  for (let step = 0; step < 12; step += 1) {
    const before = await read();
    if (before.progress > 0.9) {
      break;
    }
    await page.mouse.wheel(0, 420);
    await expect
      .poll(async () => (await read()).progress)
      .toBeGreaterThan(before.progress + 0.03);
    forward.push((await read()).beat);
  }

  expect(forward[forward.length - 1]).toBeGreaterThanOrEqual(4);
  for (let index = 1; index < forward.length; index += 1) {
    expect(forward[index] ?? 0).toBeGreaterThanOrEqual(forward[index - 1] ?? 0);
  }
  expect(new Set(forward).size).toBeGreaterThanOrEqual(4);

  const backward: number[] = [];
  for (let step = 0; step < 12; step += 1) {
    const before = await read();
    if (before.progress < 0.08) {
      break;
    }
    await page.mouse.wheel(0, -420);
    await expect
      .poll(async () => (await read()).progress)
      .toBeLessThan(before.progress - 0.03);
    backward.push((await read()).beat);
  }

  for (let index = 1; index < backward.length; index += 1) {
    expect(backward[index] ?? 0).toBeLessThanOrEqual(backward[index - 1] ?? 0);
  }
  expect(backward[backward.length - 1]).toBeLessThanOrEqual(2);
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
