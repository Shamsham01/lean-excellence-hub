import { describe, expect, it } from "vitest";

import {
  DIALOG_VIEWPORT_GUTTER_PX,
  dialogVisibleFrame,
} from "@/components/ui/dialog-viewport";

describe("dialogVisibleFrame", () => {
  it("centres a desktop dialog inside the visual viewport", () => {
    expect(
      dialogVisibleFrame({
        visualHeight: 900,
        visualOffsetTop: 0,
        safeAreaTop: 0,
        safeAreaBottom: 0,
      }),
    ).toEqual({
      maxHeight: 900 - DIALOG_VIEWPORT_GUTTER_PX,
      top: 450,
    });
  });

  it("caps a short phone viewport without using a fixed height", () => {
    expect(
      dialogVisibleFrame({
        visualHeight: 568,
        visualOffsetTop: 0,
        safeAreaTop: 0,
        safeAreaBottom: 0,
      }),
    ).toEqual({
      maxHeight: 568 - DIALOG_VIEWPORT_GUTTER_PX,
      top: 284,
    });
  });

  it("moves the shell into the visible area when the keyboard shrinks it", () => {
    expect(
      dialogVisibleFrame({
        visualHeight: 320,
        visualOffsetTop: 400,
        safeAreaTop: 0,
        safeAreaBottom: 0,
      }),
    ).toEqual({
      maxHeight: 320 - DIALOG_VIEWPORT_GUTTER_PX,
      top: 560,
    });
  });

  it("keeps the shell inside safe-area insets", () => {
    expect(
      dialogVisibleFrame({
        visualHeight: 800,
        visualOffsetTop: 0,
        safeAreaTop: 47,
        safeAreaBottom: 34,
      }),
    ).toEqual({
      maxHeight: 800 - 47 - 34 - DIALOG_VIEWPORT_GUTTER_PX,
      top: 47 + (800 - 47 - 34) / 2,
    });
  });

  it("ignores negative or non-finite insets", () => {
    expect(
      dialogVisibleFrame({
        visualHeight: 400,
        visualOffsetTop: 10,
        safeAreaTop: Number.NaN,
        safeAreaBottom: -8,
      }),
    ).toEqual({
      maxHeight: 400 - DIALOG_VIEWPORT_GUTTER_PX,
      top: 210,
    });
  });
});
