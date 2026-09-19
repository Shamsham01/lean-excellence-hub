import { describe, expect, it } from "vitest";

import {
  isExternalHref,
  isModifiedClick,
  resolveAppHref,
  shouldPreserveBrowserDefault,
} from "@/lib/navigation/app-link-click";

function click(overrides: Partial<Parameters<typeof isModifiedClick>[0]> = {}) {
  return {
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    ...overrides,
  };
}

describe("resolveAppHref", () => {
  it("returns string hrefs unchanged", () => {
    expect(resolveAppHref("/platform/suggestions")).toBe(
      "/platform/suggestions",
    );
  });

  it("serializes pathname, query, and hash objects", () => {
    expect(
      resolveAppHref({
        pathname: "/platform/suggestions",
        query: { status: "implemented", page: "2" },
        hash: "#register",
      }),
    ).toBe("/platform/suggestions?status=implemented&page=2#register");
  });
});

describe("shouldPreserveBrowserDefault", () => {
  it("lets unmodified primary clicks use the shared document-navigation path", () => {
    expect(
      shouldPreserveBrowserDefault(click(), {
        href: "/platform/suggestions",
      }),
    ).toBe(false);
  });

  it("preserves cmd/ctrl/shift/alt and non-primary clicks", () => {
    expect(
      shouldPreserveBrowserDefault(click({ metaKey: true }), {
        href: "/platform/suggestions",
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click({ ctrlKey: true }), {
        href: "/platform/suggestions",
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click({ shiftKey: true }), {
        href: "/platform/actions",
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click({ altKey: true }), {
        href: "/platform/actions",
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click({ button: 1 }), {
        href: "/platform/actions",
      }),
    ).toBe(true);
  });

  it("preserves cancelled clicks, downloads, blank targets, and external hrefs", () => {
    expect(
      shouldPreserveBrowserDefault(click({ defaultPrevented: true }), {
        href: "/platform/suggestions",
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click(), {
        href: "/platform/suggestions",
        download: true,
      }),
    ).toBe(true);
    expect(
      shouldPreserveBrowserDefault(click(), {
        href: "/platform/suggestions",
        target: "_blank",
      }),
    ).toBe(true);
    expect(isExternalHref("https://example.com", "http://localhost:3000")).toBe(
      true,
    );
    expect(
      shouldPreserveBrowserDefault(click(), {
        href: "https://example.com",
      }),
    ).toBe(true);
  });

  it("does not hijack a nested button inside the link", () => {
    const currentTarget = document.createElement("a");
    const button = document.createElement("button");
    currentTarget.append(button);

    expect(
      shouldPreserveBrowserDefault(click({ currentTarget, target: button }), {
        href: "/platform/actions/1",
      }),
    ).toBe(true);
  });
});

describe("isModifiedClick", () => {
  it("treats only an unmodified left click as an in-document activation", () => {
    expect(isModifiedClick(click())).toBe(false);
    expect(isModifiedClick(click({ ctrlKey: true }))).toBe(true);
  });
});
