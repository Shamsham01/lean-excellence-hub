import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
});

function OpenDialog({
  bodyClassName,
  flush,
  contentRef,
}: {
  bodyClassName?: string;
  flush?: boolean;
  contentRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Dialog open>
      <DialogContent
        {...(contentRef ? { ref: contentRef } : {})}
        {...(flush ? { flush: true } : {})}
        {...(bodyClassName ? { bodyClassName } : {})}
        data-testid="dialog-shell"
      >
        <DialogHeader>
          <DialogTitle>Test dialog</DialogTitle>
        </DialogHeader>
        <p>Body copy</p>
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent body layout", () => {
  it("applies default padding and gap on the scroll region", () => {
    render(<OpenDialog />);
    const scroller = screen
      .getByRole("dialog")
      .querySelector<HTMLElement>("[data-dialog-scroll]");
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain("py-6");
    expect(scroller?.className).toContain("pl-6");
    expect(scroller?.className).toContain("pr-14");
    expect(scroller?.className).toContain("gap-4");
  });

  it("merges bodyClassName onto the scroll region", () => {
    render(<OpenDialog bodyClassName="gap-2 p-0" flush />);
    const scroller = screen
      .getByRole("dialog")
      .querySelector<HTMLElement>("[data-dialog-scroll]");
    expect(scroller?.className).toContain("gap-2");
    expect(scroller?.className).toContain("p-0");
    expect(scroller?.className).not.toContain("py-6");
  });

  it("forwards a ref to the Radix content node", () => {
    const ref = createRef<HTMLDivElement>();
    render(<OpenDialog contentRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("role", "dialog");
  });
});

describe("DialogContent wheel forwarding", () => {
  it("does not scroll the dialog body when the wheel target is a nested scroller", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="wheel-dialog">
          <div
            data-testid="nested-list"
            style={{ height: 96, overflowY: "auto" }}
          >
            {Array.from({ length: 20 }, (_, index) => (
              <p key={index}>Row {index + 1}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    const scroller = dialog.querySelector<HTMLElement>("[data-dialog-scroll]");
    const nested = screen.getByTestId("nested-list");
    expect(scroller).not.toBeNull();

    Object.defineProperty(nested, "scrollHeight", {
      value: 480,
      configurable: true,
    });
    Object.defineProperty(nested, "clientHeight", {
      value: 96,
      configurable: true,
    });
    Object.defineProperty(scroller!, "scrollHeight", {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(scroller!, "clientHeight", {
      value: 200,
      configurable: true,
    });

    scroller!.scrollTop = 0;
    nested.scrollTop = 0;

    const wheel = new WheelEvent("wheel", {
      deltaY: 40,
      bubbles: true,
      cancelable: true,
    });
    vi.spyOn(wheel, "preventDefault");
    nested.dispatchEvent(wheel);

    expect(scroller!.scrollTop).toBe(0);
    expect(wheel.preventDefault).not.toHaveBeenCalled();
  });
});
