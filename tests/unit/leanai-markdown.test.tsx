import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeanAiMarkdown } from "@/components/leanai/leanai-markdown";
import { safeMarkdownHref } from "@/lib/leanai/safe-markdown-url";

afterEach(() => {
  cleanup();
});

describe("safeMarkdownHref", () => {
  it("allows http, https, and mailto, and rejects unsafe schemes", () => {
    expect(safeMarkdownHref("https://example.com/setup")).toBe(
      "https://example.com/setup",
    );
    expect(safeMarkdownHref("mailto:owner@example.com")).toContain(
      "mailto:owner@example.com",
    );
    expect(safeMarkdownHref("javascript:alert(1)")).toBeNull();
    expect(safeMarkdownHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeMarkdownHref("data:text/html,hi")).toBeNull();
    expect(safeMarkdownHref("//example.com")).toBeNull();
    expect(safeMarkdownHref("https://user:pass@example.com")).toBeNull();
  });
});

describe("LeanAiMarkdown", () => {
  it("renders headings, emphasis, lists, breaks, links, and code", () => {
    const { container } = render(
      <LeanAiMarkdown
        text={[
          "## Next step",
          "",
          "Publish one **shared** *standard*.",
          "",
          "Line one",
          "Line two",
          "",
          "- Confirm the owner",
          "- Record the gap",
          "",
          "1. First",
          "2. Second",
          "",
          "See [the public note](https://example.com/setup).",
          "",
          "Use `site quantity`.",
          "",
          "```",
          "gap = hot - cold",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Next step" })).toBeVisible();
    expect(container.querySelector("strong")?.textContent).toBe("shared");
    expect(container.querySelector("em")?.textContent).toBe("standard");
    expect(container.querySelectorAll("br").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    const link = screen.getByRole("link", { name: "the public note" });
    expect(link).toHaveAttribute("href", "https://example.com/setup");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector("code")?.textContent).toContain(
      "site quantity",
    );
    expect(container.querySelector("pre")?.textContent).toContain(
      "gap = hot - cold",
    );
  });

  it("does not execute HTML, unsafe links, or images", () => {
    const { container } = render(
      <LeanAiMarkdown
        text={[
          "<script>alert(1)</script>",
          '<img src="x" onerror="alert(1)">',
          '<a href="https://example.com" onclick="alert(1)">click</a>',
          "",
          "[bad](javascript:alert(1))",
          "",
          "[data](data:text/html,hi)",
          "",
          "![pixel](https://example.com/pixel.png)",
        ].join("\n")}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
    expect(container.innerHTML).not.toContain("data:text/html");
    expect(container.innerHTML).not.toContain("onerror");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
